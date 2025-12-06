// 启动脚本
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { main: deployContract } = require('./scripts/deploy.js');

console.log('🚀 启动 VGate 身份验证系统...\n');
console.log('==========================================');

// 检查依赖
console.log('1. 📦 检查项目依赖...');
try {
  execSync('npm list hardhat', { stdio: 'pipe' });
  console.log('✅ 依赖检查通过');
} catch (error) {
  console.log('⚠️ 依赖未完全安装，正在安装...');
  execSync('npm install', { stdio: 'inherit' });
}

// 编译合约
console.log('\n2. 🔧 编译智能合约...');
try {
  execSync('npx hardhat compile', { stdio: 'inherit' });
  console.log('✅ 合约编译成功');
} catch (error) {
  console.log('❌ 合约编译失败，继续启动后端...');
}

// 启动Hardhat节点（后台进程）
console.log('\n3. 📡 启动Hardhat本地网络...');
const hardhatProcess = spawn('npx', ['hardhat', 'node'], {
  detached: true,
  stdio: 'pipe'
});

// 记录进程ID，用于退出时清理
const hardhatPid = hardhatProcess.pid;

let nodeStarted = false;
let deployAttempted = false;

hardhatProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('[Hardhat]', output.trim());
  
  // 检查节点是否启动成功
  if (output.includes('Started HTTP') && !nodeStarted) {
    nodeStarted = true;
    console.log('✅ Hardhat节点已启动');
    console.log('⏳ 等待节点完全就绪...');
    
    // 等待更长的时间让节点完全就绪
    setTimeout(async () => {
      if (!deployAttempted) {
        deployAttempted = true;
        console.log('\n4. 📝 部署智能合约...');
        
        // 检查网络连接
        try {
          // 先尝试连接网络
          console.log('🔍 检查网络连接...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // 部署合约
          await deployContract();
          console.log('✅ 合约部署成功');
          
          // 部署成功后启动后端
          setTimeout(() => {
            startBackendServer();
          }, 1000);
          
        } catch (error) {
          console.log('⚠️ 合约部署失败:', error.message);
          console.log('💡 你可以稍后手动运行: npx hardhat run scripts/deploy.js --network localhost');
          
          // 即使部署失败，也启动后端（但可能无法使用上链功能）
          console.log('\n⚠️ 尝试启动后端服务器（无上链功能）...');
          startBackendServer();
        }
      }
    }, 5000); // 增加等待时间到5秒
  }
});

hardhatProcess.stderr.on('data', (data) => {
  console.error('[Hardhat Error]', data.toString());
});

// 启动后端服务器函数
function startBackendServer() {
  console.log('\n5. 🔧 启动后端服务器...');
  console.log('==========================================');
  
  const backendProcess = spawn('node', ['server.js'], {
    stdio: 'inherit',
    detached: false
  });
  
  // 后端退出时清理
  backendProcess.on('close', (code) => {
    console.log(`\n后端服务退出，代码: ${code}`);
    cleanup();
  });
}

// 如果等待一段时间后节点还没启动，尝试部署
setTimeout(async () => {
  if (!nodeStarted && !deployAttempted) {
    console.log('\n⚠️ 等待节点启动超时，尝试部署合约...');
    deployAttempted = true;
    
    try {
      await deployContract();
      console.log('✅ 合约部署成功');
      startBackendServer();
    } catch (error) {
      console.log('❌ 合约部署失败，请检查Hardhat节点是否正常运行');
      console.log('💡 你可以手动运行: npx hardhat node (在另一个终端)');
      console.log('然后运行: npx hardhat run scripts/deploy.js --network localhost');
      console.log('最后运行: node server.js');
    }
  }
}, 15000); // 15秒超时

// 优雅退出处理
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 清理函数
function cleanup() {
  console.log('\n🧹 清理进程...');
  try {
    // 终止Hardhat进程
    if (hardhatPid) {
      process.kill(-hardhatPid); // 杀死整个进程组
    }
  } catch (error) {
    // 忽略错误
  }
  console.log('👋 系统已关闭');
  process.exit(0);
}

// 进程异常处理
hardhatProcess.on('close', (code) => {
  console.log(`\nHardhat节点退出，代码: ${code}`);
});

console.log('💡 按 Ctrl+C 停止所有服务');
console.log('⏳ 请等待所有服务启动完成（可能需要10-20秒）...');