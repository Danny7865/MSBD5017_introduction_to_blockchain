// diagnose-contract.js
const { ethers } = require("ethers");
const fs = require("fs");

async function diagnose() {
  console.log("🔍 诊断合约状态不一致问题");
  console.log("==========================================\n");
  
  try {
    // 读取配置
    const contractInfo = JSON.parse(fs.readFileSync("contract-info.json", "utf8"));
    const userAddress = "0x44f4bf7a16b3056a4212e04d0c7ebcb82116bdb2";
    
    // 连接到网络
    const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
    
    // 合约ABI
    const contractABI = [
      "function isHuman(address user) public view returns (bool)",
      "function verifiers(address) public view returns (bool)",
      "event ProofSubmitted(address indexed user, address indexed verifier, bytes32 proofId)"
    ];
    
    const contract = new ethers.Contract(contractInfo.address, contractABI, provider);
    
    console.log("1. 📊 检查合约状态:");
    const isHuman = await contract.isHuman(userAddress);
    console.log(`   地址: ${userAddress}`);
    console.log(`   isHuman: ${isHuman}`);
    console.log(`   状态: ${isHuman ? '✅ 已验证' : '❌ 未验证'}\n`);
    
    console.log("2. 🔑 检查验证者:");
    const isVerifier = await contract.verifiers(contractInfo.verifier);
    console.log(`   验证者: ${contractInfo.verifier}`);
    console.log(`   是否授权: ${isVerifier ? '✅' : '❌'}\n`);
    
    console.log("3. 📜 查询所有验证事件:");
    try {
      const filter = contract.filters.ProofSubmitted();
      const events = await contract.queryFilter(filter, 0, 'latest');
      
      console.log(`   总共 ${events.length} 个验证事件:`);
      
      if (events.length > 0) {
        // 按区块排序
        events.sort((a, b) => b.blockNumber - a.blockNumber);
        
        events.forEach((event, index) => {
          console.log(`   ${index + 1}. 区块: ${event.blockNumber}`);
          console.log(`      用户: ${event.args.user}`);
          console.log(`      验证者: ${event.args.verifier}`);
          console.log(`      是否当前用户: ${event.args.user.toLowerCase() === userAddress.toLowerCase() ? '✅' : '❌'}\n`);
        });
        
        // 检查是否有当前用户的验证事件
        const userEvents = events.filter(e => 
          e.args.user.toLowerCase() === userAddress.toLowerCase()
        );
        
        if (userEvents.length > 0) {
          console.log(`   ✅ 找到 ${userEvents.length} 个该用户的验证事件`);
        } else {
          console.log(`   ❌ 未找到该用户的验证事件`);
        }
      } else {
        console.log("   ⚠️ 没有任何验证事件记录");
      }
      
    } catch (error) {
      console.log(`   ❌ 查询事件失败: ${error.message}`);
    }
    
    console.log("\n4. 🔗 检查网络信息:");
    const network = await provider.getNetwork();
    console.log(`   网络: ${network.name} (ID: ${network.chainId})`);
    console.log(`   合约地址: ${contractInfo.address}`);
    
    // 5. 检查服务器配置
    console.log("\n5. ⚙️ 检查服务器配置:");
    try {
      const serverJs = fs.readFileSync("server.js", "utf8");
      
      // 查找验证者私钥
      const verifierKeyMatch = serverJs.match(/VERIFIER_PRIVATE_KEY:\s*['"]([^'"]+)['"]/);
      if (verifierKeyMatch) {
        const serverVerifierKey = verifierKeyMatch[1];
        console.log(`   server.js 验证者私钥: ${serverVerifierKey.substring(0, 10)}...`);
        console.log(`   contract-info.json 私钥: ${contractInfo.verifierPrivateKey.substring(0, 10)}...`);
        console.log(`   是否匹配: ${serverVerifierKey === contractInfo.verifierPrivateKey ? '✅' : '❌'}`);
        
        if (serverVerifierKey !== contractInfo.verifierPrivateKey) {
          console.log(`   ⚠️ 私钥不匹配！这是导致验证失败的根本原因。`);
        }
      }
      
    } catch (error) {
      console.log(`   无法读取 server.js: ${error.message}`);
    }
    
    console.log("\n==========================================");
    console.log("诊断完成！");
    
    if (!isHuman) {
      console.log("\n💡 建议：");
      console.log("1. 用户地址在合约中未验证，但服务器记录为已上链");
      console.log("2. 可能是因为上链交易失败，但服务器错误地标记为成功");
      console.log("3. 需要手动验证用户地址");
    }
    
  } catch (error) {
    console.error("❌ 诊断失败:", error.message);
  }
}

diagnose().catch(console.error);