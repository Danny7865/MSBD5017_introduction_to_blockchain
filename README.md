# MSBD5017_introduction_to_blockchain

# Trusted Oracle MVP Project Documentation

## Project Overview

This is a Minimum Viable Product (MVP) prototype designed to demonstrate a verification workflow and on-chain interoperability using a VGate Trusted Oracle model for simulation. The backend server (`server.js`) temporarily acts as the "ZK Proof Generator" by issuing cryptographic credentials (JWT) and writing verification status to the blockchain, thereby simulating ZKP transfer and validation logic.

## Environment Requirements

### System Requirements
- **Node.js** (version 16.x or higher)
- **npm** (comes with Node.js)
- **MetaMask** browser extension
- **Foundry** (forge + cast + anvil)
- **forge-std library** (Required for unit testing in Foundry forge-std/Test.sol)
- Modern web browser (Chrome, Firefox, Edge)

### Project Dependencies
Install Hardhat dependencies:
```bash
npm install
```
Install forge-std library:
```bash
forge install foundry-rs/forge-std
```

## Startup Methods

### Method 1: One-Click Start (Quick Start)
```bash
node start.js
```
This command automatically starts all necessary services, suitable for quick demos and testing.

### Method 2: Step-by-Step Deployment (Development/Debugging)

#### Step 1: Start Local Blockchain Node
```bash
# Execute in Terminal Window 1
npx hardhat node
```
This starts a local Ethereum test network running at `http://localhost:8545`.

#### Step 2: Deploy Smart Contracts
```bash
# Execute in Terminal Window 2
npx hardhat run scripts/deploy.js --network localhost
```
This command deploys smart contracts to the local network. After successful deployment, the contract address will be displayed - please record it.

#### Step 3: Start Backend Server
```bash
# Execute in Terminal Window 3
node server.js
```


## Frontend Access

### 1. User Verification Page
Access URL: http://localhost:3000/test.html

Function: For users to submit personal information for verification.

Usage Flow:The system will generate a JWT token and display it on the page

### 2. App Verification Test Page
Access URL: http://localhost:3000/dapp-test.html

Function: To submit JWT tokens and wallet addresses to check if verification is recorded on-chain.

Usage Flow:
1. Enter the JWT token obtained from the user verification page
2. Enter the user's wallet address
3. Submit for verification
4. The system returns verification results, showing whether the verification status is successfully recorded on the blockchain

## Running Tests for Constract
All tests are located in:
```bash
test/VeriChain.t.sol
```
Run test suite:
```bash
forge test
```

## Project Architecture Overview

### Component Functions
- **Hardhat Local Node**: Simulates Ethereum blockchain environment
- **Smart Contracts**: Store and verify user verification status
- **Backend Server**: Simulates ZK Proof Generator, generates JWT credentials
- **Frontend Interface**: User interaction interface providing verification functionality

### Directory Structure
```
.
├── contracts/           # Solidity smart contracts
├── scripts/            # Deployment scripts
├── test/               # Test files
├── server.js           # Backend server
├── start.js            # One-click startup script
├── test.html           # frontend
├── hardhat.config.js   # Hardhat configuration
└── README.md           # Project documentation
```

### Custom Configuration
To modify configurations, edit these files:
- `hardhat.config.js`: Blockchain network configuration
- `server.js`: Server port and logic configuration
- `test.html`: files: UI and interaction logic

## Important Notes

1. This project is a demonstration prototype and should not be used in production
2. All data is stored locally only and will be lost after restarting services
3. JWT tokens are simulated; real applications should use more secure verification mechanisms
4. Ensure testing in a secure environment to avoid leaking private key information

## Technical Support

If encountering issues:
1. Check console error messages
2. Confirm all dependencies are properly installed
3. Follow documentation steps to re-operate
4. Review project logs for more information

---

**Getting Started**: Follow the above steps to configure the environment and start services, then visit http://localhost:3000 to begin experiencing the verification workflow.
![alt text](image.png)
