// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title VeriChain - Decentralized Human Verification Protocol
 * @notice Off-chain verifiers (VGate nodes) sign (user, nonce).
 *         The server.js backend and this smart contract use the same
 *         hashing + signing logic to ensure compatibility.
 */
contract VeriChain {
    address public owner;

    /// Approved off-chain verifiers (VGate nodes)
    mapping(address => bool) public verifiers;

    /// Whether a user has been verified as a unique human
    mapping(address => bool) public isHuman;

    /// Prevent signature replay
    mapping(bytes32 => bool) public usedProof;

    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    event ProofSubmitted(address indexed user, address indexed verifier, bytes32 proofId);
    event HumanRevoked(address indexed user);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        verifiers[msg.sender] = true;
        emit VerifierAdded(msg.sender);
    }

    /**
     * @notice Add/remove verifier
     */
    function setVerifier(address _verifier, bool allowed) external onlyOwner {
        verifiers[_verifier] = allowed;

        if (allowed) emit VerifierAdded(_verifier);
        else emit VerifierRemoved(_verifier);
    }

    /**
     * @notice messageHash = keccak256(user, nonce)
     * Must match server.js logic.
     */
    function getMessageHash(address user, uint256 nonce)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(user, nonce));
    }

    /**
     * @notice Ethereum signed hash ("\x19Ethereum Signed Message:\n32")
     * Must match server.js eth_sign hashing.
     */
    function getEthSignedMessageHash(bytes32 messageHash)
        public
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
    }

    /**
     * @notice Recover signer from ETH-signed message
     */
    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature)
        public
        pure
        returns (address)
    {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        if (v < 27) v += 27;
        require(v == 27 || v == 28, "Invalid v");

        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    /**
     * @notice Submit proof from server.js or frontend
     */
    function submitProof(
        address user,
        uint256 nonce,
        bytes calldata signature
    ) external {
        bytes32 messageHash = getMessageHash(user, nonce);
        bytes32 ethHash = getEthSignedMessageHash(messageHash);

        address signer = recoverSigner(ethHash, signature);
        require(verifiers[signer], "Invalid verifier");

        bytes32 proofId = keccak256(abi.encodePacked(ethHash, signature));
        require(!usedProof[proofId], "Proof already used");
        usedProof[proofId] = true;

        isHuman[user] = true;

        emit ProofSubmitted(user, signer, proofId);
    }

    /**
     * @notice Only owner can revoke human status
     */
    function revokeHuman(address user) external onlyOwner {
        isHuman[user] = false;
        emit HumanRevoked(user);
    }
}
