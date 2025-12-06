const hre = require("hardhat");
const fs = require("fs");
const path = require("path");  // 添加这一行
const { ethers } = require("ethers");

async function main() {
  console.log("🚀 开始部署 VGate 身份验证系统...");
  console.log("==========================================");

  // 获取部署者账户
  const [deployer] = await hre.ethers.getSigners();
  console.log(`📋 部署者地址: ${deployer.address}`);

  // 检查部署者余额
  const balance = await deployer.getBalance();
  console.log(`💰 部署者余额: ${hre.ethers.utils.formatEther(balance)} ETH`);

  // 使用有效的验证者私钥（Hardhat 测试账户的第二个私钥）
  const verifierPk = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const verifierWallet = new ethers.Wallet(verifierPk, hre.ethers.provider);
  
  console.log(`🔑 验证者地址: ${verifierWallet.address}`);
  console.log(`📝 验证者私钥: ${verifierWallet.privateKey.substring(0, 10)}...`);

  console.log("\n📦 正在部署 VeriChain 合约...");

  try {
    // 部署合约
    const VeriChain = await hre.ethers.getContractFactory("VeriChain");
    const veriChain = await VeriChain.deploy();
    await veriChain.deployed();
    
    console.log(`✅ VeriChain合约部署成功！`);
    console.log(`   📍 合约地址: ${veriChain.address}`);
    console.log(`   👤 合约所有者: ${await veriChain.owner()}`);

    // 设置验证者
    console.log(`\n⚙️ 设置验证者: ${verifierWallet.address}`);
    const setVerifierTx = await veriChain.setVerifier(verifierWallet.address, true);
    await setVerifierTx.wait();
    console.log("✅ 验证者设置成功");

    // 验证设置是否成功
    const isVerifier = await veriChain.verifiers(verifierWallet.address);
    console.log(`🔍 验证者状态检查: ${isVerifier ? '✅ 已授权' : '❌ 未授权'}`);

    // 保存合约信息
    const contractInfo = {
      address: veriChain.address,
      deployer: deployer.address,
      owner: await veriChain.owner(),
      verifier: verifierWallet.address,
      verifierPrivateKey: verifierWallet.privateKey,
      network: "localhost",
      chainId: (await hre.ethers.provider.getNetwork()).chainId,
      timestamp: new Date().toISOString(),
      contractName: "VeriChain"
    };

    // 确保目录存在（修复这里的 path 引用）
    const infoDir = path.dirname('./contract-info.json');
    if (infoDir && !fs.existsSync(infoDir)) {
      fs.mkdirSync(infoDir, { recursive: true });
    }

    fs.writeFileSync(
      "contract-info.json",
      JSON.stringify(contractInfo, null, 2)
    );
    
    // 也单独保存验证者信息
    fs.writeFileSync(
      "verifier-info.json",
      JSON.stringify({
        address: verifierWallet.address,
        privateKey: verifierWallet.privateKey,
        note: "这是VGate系统的验证者私钥，用于在server.js中签名验证请求",
        warning: "⚠️ 在生产环境中请确保私钥安全！"
      }, null, 2)
    );

    console.log(`\n📄 合约信息已保存到 contract-info.json`);
    console.log(`📄 验证者信息已保存到 verifier-info.json`);
    console.log("==========================================");
    console.log("重要信息：");
    console.log(`   合约地址: ${contractInfo.address}`);
    console.log(`   验证者地址: ${contractInfo.verifier}`);
    console.log(`   验证者私钥: ${contractInfo.verifierPrivateKey.substring(0, 10)}...`);
    console.log("==========================================");

    // 更新 server.js 中的验证者私钥配置
    updateServerConfig(verifierWallet.privateKey, veriChain.address);

    // 提供使用说明
    console.log("\n🎉 部署完成！下一步：");
    console.log("1. 📡 启动后端服务器: node server.js");
    console.log("2. 🌐 访问测试页面: http://localhost:3000/test.html");
    console.log("3. 🔑 验证者私钥已自动更新到 server.js");

  } catch (error) {
    console.error("❌ 部署过程中出现错误:");
    console.error(error.message);
    console.error("\n完整错误信息:");
    console.error(error);
    process.exit(1);
  }
}

// 更新 server.js 配置的函数
function updateServerConfig(verifierPrivateKey, contractAddress) {
  try {
    const serverJsPath = path.join(__dirname, '../server.js');
    let serverJs = fs.readFileSync(serverJsPath, 'utf8');
    
    // 更新验证者私钥
    const verifierKeyRegex = /VERIFIER_PRIVATE_KEY:\s*['"][^'"]*['"]/;
    if (verifierKeyRegex.test(serverJs)) {
      serverJs = serverJs.replace(
        verifierKeyRegex,
        `VERIFIER_PRIVATE_KEY: '${verifierPrivateKey}'`
      );
      console.log("✅ 已更新 server.js 中的验证者私钥");
    }
    
    // 更新合约地址（如果配置中有）
    const contractAddrRegex = /CONTRACT_ADDRESS:\s*null/;
    if (contractAddrRegex.test(serverJs)) {
      serverJs = serverJs.replace(
        contractAddrRegex,
        `CONTRACT_ADDRESS: '${contractAddress}'`
      );
      console.log("✅ 已更新 server.js 中的合约地址");
    }
    
    fs.writeFileSync(serverJsPath, serverJs, 'utf8');
  } catch (error) {
    console.log(`⚠️ 更新 server.js 配置失败: ${error.message}`);
    console.log("💡 请手动更新 server.js 中的以下配置:");
    console.log(`   VERIFIER_PRIVATE_KEY: '${verifierPrivateKey}'`);
    console.log(`   CONTRACT_ADDRESS: '${contractAddress}'`);
  }
}

// 如果通过 require 调用则不执行 main
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

// 导出 main 函数供其他脚本使用
module.exports = { main };