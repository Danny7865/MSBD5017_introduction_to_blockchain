// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/VeriChain.sol";

contract VeriChainTest is Test {
    VeriChain vc;

    address owner = address(0xA1);
    address user = address(0xC1);

    // Fake private key used to simulate an approved off-chain verifier
    uint256 verifierPk = 0x123456;
    address verifier;

    function setUp() public {
        // Derive verifier address
        verifier = vm.addr(verifierPk);

        // Deploy contract as owner
        vm.startPrank(owner);
        vc = new VeriChain();
        vm.stopPrank();

        // Register verifier
        vm.prank(owner);
        vc.setVerifier(verifier, true);
    }

    function testSubmitProof() public {
        uint256 nonce = 42;

        bytes32 messageHash = vc.getMessageHash(user, nonce);
        bytes32 ethHash = vc.getEthSignedMessageHash(messageHash);

        // Sign message with verifier's private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, ethHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        assertFalse(vc.isHuman(user));

        // Expect event emission
        vm.expectEmit(true, true, false, true);
        emit VeriChain.ProofSubmitted(user, verifier, keccak256(abi.encodePacked(ethHash, signature)));

        vc.submitProof(user, nonce, signature);

        assertTrue(vc.isHuman(user));
    }

    function testReplayFails() public {
        uint256 nonce = 100;

        bytes32 messageHash = vc.getMessageHash(user, nonce);
        bytes32 ethHash = vc.getEthSignedMessageHash(messageHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, ethHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vc.submitProof(user, nonce, signature);

        // Replay should revert
        vm.expectRevert("Proof already used");
        vc.submitProof(user, nonce, signature);
    }

    function testNonVerifierSignatureFails() public {
        uint256 nonce = 77;

        bytes32 messageHash = vc.getMessageHash(user, nonce);
        bytes32 ethHash = vc.getEthSignedMessageHash(messageHash);

        // sign using incorrect key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0x9999, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid verifier");
        vc.submitProof(user, nonce, badSig);
    }

    function testRevokeHuman() public {
        uint256 nonce = 55;

        bytes32 messageHash = vc.getMessageHash(user, nonce);
        bytes32 ethHash = vc.getEthSignedMessageHash(messageHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(verifierPk, ethHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vc.submitProof(user, nonce, signature);
        assertTrue(vc.isHuman(user));

        vm.prank(owner);
        vc.revokeHuman(user);
        assertFalse(vc.isHuman(user));
    }

    function testOnlyOwnerCanRevoke() public {
        vm.expectRevert("Not owner");
        vc.revokeHuman(address(0x1111));
    }
}
