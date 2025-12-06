// server.js 完整修改版本 - 修复合约状态不一致问题

// 后端服务器 - CommonJS格式
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ============= 配置 =============
const CONFIG = {
  JWT_SECRET: 'verichain-course-project-2024',
  RPC_URL: 'http://localhost:8545',
  PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  CONTRACT_ADDRESS: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  KYC_SERVICE_URL: 'https://mock-kyc-service.com/api',
  // 验证者私钥（与测试合约中的verifierPk一致）
  VERIFIER_PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
};

// 尝试读取合约信息
try {
  if (fs.existsSync('contract-info.json')) {
    const contractInfo = JSON.parse(fs.readFileSync('contract-info.json', 'utf8'));
    CONFIG.CONTRACT_ADDRESS = contractInfo.address;
    console.log(`📄 读取合约地址: ${CONFIG.CONTRACT_ADDRESS}`);
    
    // 如果配置中没有验证者私钥，但合约信息中有，则更新
    if (!CONFIG.VERIFIER_PRIVATE_KEY && contractInfo.verifierPrivateKey) {
      CONFIG.VERIFIER_PRIVATE_KEY = contractInfo.verifierPrivateKey;
      console.log(`🔑 从合约信息读取验证者私钥`);
    }
  } else {
    console.log('⚠️ 未找到合约信息，请先部署合约');
  }
} catch (error) {
  console.log('⚠️ 读取合约信息失败:', error.message);
}

// 内存存储 - 仅存储验证状态，不存储原始KYC信息
const storage = {
  users: new Map(),      // address -> {kycId, verified, verifiedAt, kycStatus}
  nonces: new Map(),     // address -> {nonce, expires}
  proofs: new Map(),     // proofHash -> address
  kycRequests: new Map() // requestId -> {address, kycId, status}
};

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============= 辅助函数 =============

// 模拟KYC服务调用（实际项目中替换为真实的KYC服务）
async function mockKycService(kycInfo) {
  console.log('🔍 模拟KYC服务调用，验证信息:', {
    name: kycInfo.name,
    idType: kycInfo.idType,
    idMasked: kycInfo.idNumber ? kycInfo.idNumber.substring(0, 4) + '****' + kycInfo.idNumber.substring(kycInfo.idNumber.length - 4) : null
  });
  
  // 模拟处理延迟
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 模拟验证逻辑（课程项目中简单验证格式）
  const isValid = kycInfo.name && kycInfo.idNumber && kycInfo.idType;
  
  if (!isValid) {
    return {
      success: false,
      error: 'KYC信息不完整',
      kycId: null
    };
  }
  
  // 生成唯一的KYC ID（实际项目中由KYC服务生成）
  const kycId = `kyc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  
  return {
    success: true,
    kycId: kycId,
    status: 'verified',
    verifiedAt: new Date().toISOString(),
    // 注意：不返回用户的原始KYC信息
    metadata: {
      country: kycInfo.country || 'unknown',
      idType: kycInfo.idType,
      // 其他不敏感元数据
    }
  };
}

// ============= 辅助函数：查询合约状态 =============

// 实时查询合约状态的函数
async function checkContractStatus(address) {
  try {
    if (!CONFIG.CONTRACT_ADDRESS) {
      console.log('⚠️ 未配置合约地址，无法查询合约状态');
      return false;
    }
    
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
    
    const contractABI = [
      "function isHuman(address user) public view returns (bool)"
    ];
    
    const contract = new ethers.Contract(
      CONFIG.CONTRACT_ADDRESS,
      contractABI,
      provider
    );
    
    const isHuman = await contract.isHuman(address);
    console.log(`🔍 实时查询合约: ${address} -> ${isHuman ? '✅ 已验证' : '❌ 未验证'}`);
    return isHuman;
    
  } catch (error) {
    console.error(`❌ 查询合约状态失败: ${error.message}`);
    return false;
  }
}

// ============= API端点 =============

// 1. 首页
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>🔐 VGate 身份验证系统</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        code { background: #eee; padding: 2px 5px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <h1>🔐 VGate 身份验证系统</h1>
      <p><strong>课程项目 - 基于JWT的Web3身份验证</strong></p>
      <p><em>隐私保护设计：后端不存储用户原始KYC信息，只存储验证状态和KYC ID</em></p>
      
      <div class="endpoint">
        <h3>📊 系统状态</h3>
        <p><a href="/api/status">查看状态</a></p>
      </div>
      
      <div class="endpoint">
        <h3>🔄 API端点</h3>
        <ul>
          <li><code>GET /api/status</code> - 系统状态</li>
          <li><code>POST /api/kyc/submit</code> - 提交KYC验证请求</li>
          <li><code>GET /api/kyc/status/:kycId</code> - 查询KYC状态</li>
          <li><code>GET /api/nonce/:address</code> - 获取nonce</li>
          <li><code>POST /api/verify</code> - 请求验证</li>
          <li><code>GET /api/user/:address</code> - 查询用户状态</li>
          <li><code>POST /api/dapp/verify</code> - DApp验证令牌</li>
        </ul>
      </div>
      
      <div class="endpoint">
        <h3>🧪 测试页面</h3>
        <p><a href="/test.html">打开测试页面</a></p>
        <p><a href="/dapp-test.html">DApp验证用户测试</a></p>
      </div>
    </body>
    </html>
  `);
});

// 2. 系统状态
app.get('/api/status', (req, res) => {
  const hasContract = !!CONFIG.CONTRACT_ADDRESS;
  
  res.json({
    service: 'VGate Identity Verification',
    version: '1.0.0',
    status: 'running',
    port: PORT,
    timestamp: new Date().toISOString(),
    privacyNotice: '本系统不存储用户原始KYC信息，只存储验证状态和KYC ID',
    config: {
      hasContract: hasContract,
      contractAddress: CONFIG.CONTRACT_ADDRESS,
      network: 'Hardhat Local',
      // 添加验证者信息
      verifierConfigured: !!CONFIG.VERIFIER_PRIVATE_KEY
    },
    storage: {
      users: storage.users.size,
      kycRequests: storage.kycRequests.size,
      proofs: storage.proofs.size
    }
  });
});

// 3. KYC提交端点 - 前端直接调用KYC服务（这里只是模拟）
app.post('/api/kyc/submit', async (req, res) => {
  try {
    const { address, kycInfo } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少钱包地址' 
      });
    }
    
    if (!kycInfo || !kycInfo.name || !kycInfo.idNumber) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要的KYC信息' 
      });
    }
    
    const userAddress = address.toLowerCase();
    
    console.log(`🔍 接收到KYC验证请求: ${userAddress}`);
    
    // 模拟调用KYC服务
    const kycResult = await mockKycService(kycInfo);
    
    if (!kycResult.success) {
      return res.json({
        success: false,
        error: kycResult.error
      });
    }
    
    // 存储KYC验证结果（不存储原始KYC信息）
    storage.kycRequests.set(kycResult.kycId, {
      address: userAddress,
      kycId: kycResult.kycId,
      status: kycResult.status,
      verifiedAt: kycResult.verifiedAt,
      metadata: kycResult.metadata,
      // 注意：不存储 name, idNumber 等原始信息
    });
    
    console.log(`✅ KYC验证成功，生成KYC ID: ${kycResult.kycId}`);
    
    res.json({
      success: true,
      kycId: kycResult.kycId,
      status: kycResult.status,
      verifiedAt: kycResult.verifiedAt,
      // 不返回用户的原始KYC信息
    });
    
  } catch (error) {
    console.error('❌ KYC提交错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// 4. 查询KYC状态
app.get('/api/kyc/status/:kycId', (req, res) => {
  try {
    const kycId = req.params.kycId;
    const kycData = storage.kycRequests.get(kycId);
    
    if (!kycData) {
      return res.json({
        success: false,
        error: '未找到KYC记录'
      });
    }
    
    res.json({
      success: true,
      kycId: kycData.kycId,
      status: kycData.status,
      verifiedAt: kycData.verifiedAt,
      address: kycData.address,
      // 注意：不返回用户的原始KYC信息
      metadata: kycData.metadata
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. 获取nonce
app.get('/api/nonce/:address', (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    
    // 验证地址格式
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: '无效的地址格式' });
    }
    
    // 生成nonce
    const nonce = crypto.randomBytes(16).toString('hex');
    const expires = Date.now() + 5 * 60 * 1000; // 5分钟过期
    
    storage.nonces.set(address, { nonce, expires });
    
    res.json({
      success: true,
      address: address,
      nonce: nonce,
      message: `请签名以下消息进行验证: ${nonce}`,
      expires: new Date(expires).toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. 验证请求（核心功能） - 现在需要KYC ID
app.post('/api/verify', async (req, res) => {
  try {
    console.log('📨 收到验证请求:', { 
      address: req.body.address,
      hasKycId: !!req.body.kycId 
    });
    
    const { address, signature, kycId } = req.body;
    
    // 验证参数
    if (!address || !signature) {
      return res.status(400).json({ error: '缺少地址或签名' });
    }
    
    const userAddress = address.toLowerCase();
    
    // 检查KYC状态
    if (!kycId) {
      return res.status(400).json({ error: '缺少KYC ID，请先完成KYC验证' });
    }
    
    const kycData = storage.kycRequests.get(kycId);
    if (!kycData) {
      return res.status(400).json({ error: 'KYC ID无效或未找到' });
    }
    
    if (kycData.address.toLowerCase() !== userAddress) {
      return res.status(400).json({ error: 'KYC ID与钱包地址不匹配' });
    }
    
    if (kycData.status !== 'verified') {
      return res.status(400).json({ error: 'KYC验证未通过' });
    }
    
    // 检查nonce
    const nonceData = storage.nonces.get(userAddress);
    if (!nonceData) {
      return res.status(400).json({ error: '请先获取nonce' });
    }
    
    if (Date.now() > nonceData.expires) {
      storage.nonces.delete(userAddress);
      return res.status(400).json({ error: 'nonce已过期，请重新获取' });
    }
    
    // 验证签名
    const message = `请签名以下消息进行验证: ${nonceData.nonce}`;
    let recoveredAddress;
    
    try {
      recoveredAddress = ethers.utils.verifyMessage(message, signature);
    } catch (error) {
      return res.status(400).json({ error: '签名验证失败: ' + error.message });
    }
    
    if (recoveredAddress.toLowerCase() !== userAddress) {
      return res.status(400).json({ error: '签名不匹配' });
    }
    
    // 清除nonce
    storage.nonces.delete(userAddress);
    
    console.log(`✅ 签名验证成功: ${userAddress}, KYC ID: ${kycId}`);
    
    // 生成JWT证明
    const payload = {
      sub: userAddress,
      kycId: kycId,
      verified: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24小时
      jti: crypto.randomBytes(16).toString('hex')
    };
    
    const token = jwt.sign(payload, CONFIG.JWT_SECRET);
    const proofHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // 存储用户验证状态（不存储原始KYC信息）
    const userData = {
      address: userAddress,
      verified: true,
      verifiedAt: new Date().toISOString(),
      kycId: kycId,
      kycStatus: kycData.status,
      proofHash: proofHash,
      token: token,
      onChain: false // 初始为false，上链成功后更新
    };
    
    storage.users.set(userAddress, userData);
    storage.proofs.set(proofHash, userAddress);
    
    console.log(`📝 生成JWT证明: ${proofHash.substring(0, 16)}...`);
    
    // 可选：上链
    let blockchainResult = null;
    if (CONFIG.CONTRACT_ADDRESS) {
      try {
        blockchainResult = await submitToBlockchain(userAddress);
        
        // 重要：只有真正上链成功才更新onChain状态
        if (blockchainResult.success && (blockchainResult.verified || blockchainResult.alreadyVerified)) {
          // 实时查询合约确认状态
          const contractStatus = await checkContractStatus(userAddress);
          if (contractStatus) {
            userData.onChain = true;
            console.log(`✅ 确认合约状态：用户 ${userAddress} 已在链上验证`);
          } else {
            console.log(`⚠️ 合约状态不一致：服务器认为上链成功，但合约未记录`);
            userData.onChain = false;
          }
        } else {
          userData.onChain = false;
        }
        
        storage.users.set(userAddress, userData);
        
      } catch (error) {
        console.log('⚠️ 上链失败:', error.message);
        userData.onChain = false;
        storage.users.set(userAddress, userData);
      }
    }
    
    res.json({
      success: true,
      message: '身份验证成功！',
      user: {
        address: userAddress,
        verified: true,
        kycId: kycId,
        kycStatus: kycData.status
      },
      proof: {
        token: token,
        proofHash: proofHash,
        expiresIn: '24小时'
      },
      blockchain: blockchainResult,
      privacyNotice: '系统不存储您的原始KYC信息，只存储验证状态'
    });
    
  } catch (error) {
    console.error('❌ 验证过程错误:', error);
    res.status(500).json({ 
      error: '服务器内部错误',
      details: error.message 
    });
  }
});

// 7. 查询用户状态
app.get('/api/user/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const userData = storage.users.get(address);
    
    if (!userData) {
      return res.json({
        verified: false,
        address: address,
        message: '该地址未验证'
      });
    }
    
    // 验证JWT是否有效
    try {
      const decoded = jwt.verify(userData.token, CONFIG.JWT_SECRET);
      
      // 实时查询合约状态，确保状态准确
      let realOnChainStatus = false;
      if (CONFIG.CONTRACT_ADDRESS) {
        try {
          realOnChainStatus = await checkContractStatus(address);
        } catch (error) {
          console.log(`⚠️ 查询合约状态失败，使用存储状态: ${error.message}`);
          realOnChainStatus = userData.onChain || false;
        }
      }
      
      res.json({
        verified: true,
        address: address,
        kycId: userData.kycId,
        kycStatus: userData.kycStatus,
        verifiedAt: userData.verifiedAt,
        proofHash: userData.proofHash,
        onChain: realOnChainStatus, // 使用实时查询的合约状态
        expires: new Date(decoded.exp * 1000).toISOString()
      });
    } catch (error) {
      // JWT过期
      storage.users.delete(address);
      res.json({
        verified: false,
        address: address,
        message: '验证已过期'
      });
    }
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============= DApp验证API =============

// 8. DApp验证用户令牌
app.post('/api/dapp/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少令牌参数' 
      });
    }
    
    console.log('🔍 DApp请求验证令牌:', token.substring(0, 30) + '...');
    
    // 验证JWT
    try {
      const decoded = jwt.verify(token, CONFIG.JWT_SECRET);
      const proofHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // 检查是否在存储中
      const storedAddress = storage.proofs.get(proofHash);
      const userData = storage.users.get(decoded.sub);
      
      // 获取KYC状态信息（不包含原始KYC数据）
      const kycData = userData ? storage.kycRequests.get(userData.kycId) : null;
      
      // 实时查询合约状态，确保状态准确
      let realOnChainStatus = false;
      if (CONFIG.CONTRACT_ADDRESS) {
        try {
          realOnChainStatus = await checkContractStatus(decoded.sub);
        } catch (error) {
          console.log(`⚠️ 查询合约状态失败，使用存储状态: ${error.message}`);
          realOnChainStatus = userData?.onChain || false;
        }
      }
      
      res.json({
        success: true,
        valid: true,
        user: {
          address: decoded.sub,
          verified: decoded.verified,
          kycId: decoded.kycId,
          kycStatus: userData?.kycStatus,
          verifiedAt: userData?.verifiedAt
        },
        tokenInfo: {
          issuedAt: new Date(decoded.iat * 1000).toISOString(),
          expiresAt: new Date(decoded.exp * 1000).toISOString(),
          expiresIn: Math.max(0, decoded.exp * 1000 - Date.now()) / 1000 + '秒'
        },
        onChain: realOnChainStatus, // 使用实时查询的合约状态
        metadata: kycData?.metadata // 仅返回不敏感的元数据
      });
      
    } catch (jwtError) {
      res.json({
        success: true,
        valid: false,
        error: '令牌无效',
        reason: jwtError.message
      });
    }
    
  } catch (error) {
    console.error('❌ DApp验证错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误' 
    });
  }
});

// 9. 批量验证多个地址
app.post('/api/dapp/verify-batch', (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少地址数组参数' 
      });
    }
    
    const results = {};
    
    addresses.forEach(address => {
      const userData = storage.users.get(address.toLowerCase());
      if (userData) {
        try {
          // 验证令牌是否有效
          const decoded = jwt.verify(userData.token, CONFIG.JWT_SECRET);
          results[address] = {
            verified: true,
            kycId: userData.kycId,
            kycStatus: userData.kycStatus,
            verifiedAt: userData.verifiedAt,
            expiresAt: new Date(decoded.exp * 1000).toISOString()
          };
        } catch (e) {
          results[address] = {
            verified: false,
            reason: '令牌过期或无效'
          };
        }
      } else {
        results[address] = {
          verified: false,
          reason: '地址未验证'
        };
      }
    });
    
    res.json({
      success: true,
      results: results,
      count: {
        total: addresses.length,
        verified: Object.values(results).filter(r => r.verified).length
      }
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 10. 查询合约验证状态（已修复：直接查询合约）
app.get('/api/dapp/onchain-status/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    
    if (!CONFIG.CONTRACT_ADDRESS) {
      return res.json({
        success: false,
        error: '合约未部署'
      });
    }
    
    const isHuman = await checkContractStatus(address);
    
    res.json({
      success: true,
      address: address,
      onChainVerified: isHuman,
      contractAddress: CONFIG.CONTRACT_ADDRESS
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// ============= 区块链交互函数 =============
async function submitToBlockchain(address) {
  try {
    console.log(`📡 开始上链验证流程: ${address}`);
    
    // 验证合约地址
    if (!CONFIG.CONTRACT_ADDRESS) {
      console.log('⚠️ 未配置合约地址，跳过上链');
      return {
        success: false,
        error: '未配置合约地址',
        skipped: true
      };
    }
    
    // 连接到Hardhat节点
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
    const adminWallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
    
    // 检查网络连接
    const network = await provider.getNetwork();
    console.log(`🌐 网络信息: ${network.name} (ID: ${network.chainId})`);
    
    // 合约ABI - 使用VeriChain合约的ABI
    const contractABI = [
      "function submitProof(address user, uint256 nonce, bytes calldata signature) external",
      "function isHuman(address user) public view returns (bool)",
      "function getMessageHash(address _user, uint256 _nonce) public pure returns (bytes32)",
      "function getEthSignedMessageHash(bytes32 _messageHash) public pure returns (bytes32)"
    ];
    
    // 创建合约实例
    const contract = new ethers.Contract(
      CONFIG.CONTRACT_ADDRESS,
      contractABI,
      adminWallet
    );
    
    // 1. 首先检查是否已经验证过
    console.log(`🔍 检查链上验证状态...`);
    let alreadyVerified = false;
    try {
      alreadyVerified = await contract.isHuman(address);
      console.log(`📊 链上验证状态: ${alreadyVerified ? '✅ 已验证' : '❌ 未验证'}`);
    } catch (checkError) {
      console.log(`⚠️ 检查验证状态失败: ${checkError.message}`);
    }
    
    if (alreadyVerified) {
      console.log(`✅ 地址 ${address} 已在链上验证，跳过重复验证`);
      return {
        success: true,
        alreadyVerified: true,
        skipped: true,
        message: '地址已在链上验证',
        contractAddress: CONFIG.CONTRACT_ADDRESS,
        network: network.name
      };
    }
    
    // 2. 生成nonce（这里使用时间戳作为nonce）
    const nonce = Math.floor(Date.now() / 1000);
    
    // 3. 创建验证者钱包（使用测试合约中的验证者私钥）
    const verifierWallet = new ethers.Wallet(CONFIG.VERIFIER_PRIVATE_KEY, provider);
    
    console.log(`🔑 验证者地址: ${verifierWallet.address}`);
    console.log(`🔢 使用nonce: ${nonce}`);
    
    // 4. 创建消息哈希并签名（与合约逻辑匹配）
    console.log(`📝 创建签名消息...`);
    
    // 方法1：调用合约的view函数获取哈希
    let messageHash;
    try {
      messageHash = await contract.getMessageHash(address, nonce);
      console.log(`✅ 获取messageHash: ${messageHash}`);
    } catch (error) {
      // 如果合约调用失败，自己计算（应该与合约中的计算方法一致）
      console.log(`⚠️ 调用合约getMessageHash失败，本地计算: ${error.message}`);
      messageHash = ethers.utils.solidityKeccak256(
        ['address', 'uint256'],
        [address, nonce]
      );
    }
    
    // 获取以太坊签名消息哈希
    let ethHash;
    try {
      ethHash = await contract.getEthSignedMessageHash(messageHash);
      console.log(`✅ 获取ethHash: ${ethHash}`);
    } catch (error) {
      // 本地计算
      console.log(`⚠️ 调用合约getEthSignedMessageHash失败，本地计算: ${error.message}`);
      const prefix = "\x19Ethereum Signed Message:\n32";
      ethHash = ethers.utils.solidityKeccak256(
        ['string', 'bytes32'],
        [prefix, messageHash]
      );
    }
    
    // 5. 验证者签名 - 修复签名方式
    console.log(`✍️ 验证者签名...`);
    let signature;
    try {
      // 使用正确的签名方式：signDigest
      const signingKey = new ethers.utils.SigningKey(CONFIG.VERIFIER_PRIVATE_KEY);
      const signatureDigest = signingKey.signDigest(ethHash);
      signature = ethers.utils.joinSignature(signatureDigest);
      console.log(`✅ 签名生成: ${signature.substring(0, 50)}...`);
      
      // 验证签名是否正确
      const recoveredAddress = ethers.utils.recoverAddress(ethHash, signature);
      console.log(`🔍 恢复的地址: ${recoveredAddress}`);
      console.log(`🔍 验证者地址: ${verifierWallet.address}`);
      console.log(`🔍 是否匹配: ${recoveredAddress === verifierWallet.address ? '✅' : '❌'}`);
      
      if (recoveredAddress !== verifierWallet.address) {
        console.log(`❌ 签名恢复的地址不匹配！签名可能无效。`);
        return {
          success: false,
          error: '签名恢复的地址与验证者地址不匹配',
          recoveredAddress: recoveredAddress,
          expectedAddress: verifierWallet.address
        };
      }
    } catch (signError) {
      console.error(`❌ 签名失败: ${signError.message}`);
      return {
        success: false,
        error: `签名失败: ${signError.message}`,
        contractAddress: CONFIG.CONTRACT_ADDRESS,
        network: network.name
      };
    }
    
    // 6. 尝试验证用户
    console.log(`⏳ 发送验证交易...`);
    try {
      const tx = await contract.submitProof(address, nonce, signature);
      console.log(`📤 交易已发送，哈希: ${tx.hash}`);
      
      // 等待确认
      console.log(`⏳ 等待交易确认...`);
      const receipt = await tx.wait();
      
      console.log(`✅ 交易成功！`);
      console.log(`   - 交易哈希: ${tx.hash}`);
      console.log(`   - 区块号: ${receipt.blockNumber}`);
      console.log(`   - Gas使用量: ${receipt.gasUsed.toString()}`);
      
      // 验证交易结果 - 等待区块确认后再查询
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const isNowHuman = await contract.isHuman(address);
      console.log(`🔍 验证后检查: ${isNowHuman ? '✅ 验证成功' : '❌ 验证失败'}`);
      
      if (!isNowHuman) {
        console.log(`⚠️ 交易成功但合约状态未更新，可能事件处理有问题`);
      }
      
      return {
        success: true,
        alreadyVerified: false,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        contractAddress: CONFIG.CONTRACT_ADDRESS,
        network: network.name,
        verified: isNowHuman
      };
      
    } catch (txError) {
      console.log(`🔍 交易错误详情:`, {
        message: txError.message,
        code: txError.code,
        reason: txError.reason,
        error: txError.error
      });
      
      const errorMsg = txError.message || '';
      
      // 检查是否是"Proof already used"错误
      if (errorMsg.includes('Proof already used')) {
        console.log(`✅ 地址已在上次验证中记录`);
        return {
          success: true,
          alreadyVerified: true,
          message: '地址已在上次验证中记录',
          contractAddress: CONFIG.CONTRACT_ADDRESS,
          network: network.name
        };
      }
      
      // 检查是否是"Invalid verifier"错误
      if (errorMsg.includes('Invalid verifier')) {
        console.log(`❌ 验证者无效，签名验证失败`);
        return {
          success: false,
          error: '验证者无效，签名验证失败',
          contractAddress: CONFIG.CONTRACT_ADDRESS,
          network: network.name
        };
      }
      
      // 其他错误
      console.error(`❌ 交易失败: ${errorMsg}`);
      
      // 尝试从错误对象中提取更多信息
      let detailedError = errorMsg;
      if (txError.error && txError.error.message) {
        detailedError = txError.error.message;
      } else if (txError.reason) {
        detailedError = txError.reason;
      }
      
      return {
        success: false,
        error: detailedError,
        contractAddress: CONFIG.CONTRACT_ADDRESS,
        network: network.name
      };
    }
    
  } catch (error) {
    console.error('❌ 上链流程失败:', error.message);
    
    // 提供更友好的错误信息
    let userFriendlyError = error.message;
    if (error.message.includes('insufficient funds')) {
      userFriendlyError = '账户余额不足，无法支付Gas费用';
    } else if (error.message.includes('network')) {
      userFriendlyError = '网络连接失败，请检查Hardhat节点是否运行';
    } else if (error.message.includes('contract')) {
      userFriendlyError = '合约交互失败，请检查合约地址是否正确';
    }
    
    return {
      success: false,
      error: userFriendlyError,
      rawError: error.message,
      contractAddress: CONFIG.CONTRACT_ADDRESS
    };
  }
}

// ============= 启动服务器 =============
app.listen(PORT, () => {
  console.log(`
==========================================
🚀 VGate 后端服务启动成功！
📌 地址: http://localhost:${PORT}
🔧 环境: 开发模式
📄 合约: ${CONFIG.CONTRACT_ADDRESS || '未部署'}
🔑 验证者: ${CONFIG.VERIFIER_PRIVATE_KEY ? '已配置' : '未配置'}
🛡️  隐私保护: 不存储用户原始KYC信息
==========================================
📋 API端点:
  GET  /                    - 首页
  GET  /api/status          - 系统状态
  POST /api/kyc/submit      - 提交KYC验证
  GET  /api/kyc/status/:id  - 查询KYC状态
  GET  /api/nonce/:address  - 获取nonce
  POST /api/verify          - 验证请求
  GET  /api/user/:address   - 查询用户状态
  POST /api/dapp/verify     - DApp验证令牌
==========================================
  `);
});