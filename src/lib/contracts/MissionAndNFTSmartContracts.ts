
import { ethers } from 'ethers';

// ===== TYPES =====
export interface Mission {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  requiredNFTs: string[];
  rewardTokens: string;
  rewardBadgeId?: string;
  completionCriteria: {
    type: 'nft_hold' | 'contract_call' | 'signature' | 'multi_step';
    params: Record<string, any>;
  };
  ipfsMetadata: string; // ipfs:// uri
}

export interface MissionCompletion {
  userId: string;
  missionId: string;
  completedAt: number;
  proofHash: string;
  txHash?: string;
}

export interface NFTCard {
  tokenId: string;
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
  ipfsUri: string;
  owner: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  awardedAt?: number;
}

// ===== ABI DEFINITIONS =====

const MISSION_TRACKER_ABI = [
  {
    name: 'completeMission',
    type: 'function',
    inputs: [
      { name: '_missionId', type: 'string' },
      { name: '_proof', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'verifyCompletion',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_missionId', type: 'string' },
    ],
    outputs: [{ name: 'completed', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    name: 'getMissionMetadata',
    type: 'function',
    inputs: [{ name: '_missionId', type: 'string' }],
    outputs: [{ name: 'ipfsUri', type: 'string' }],
    stateMutability: 'view',
  },
  {
    name: 'rewardUser',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_missionId', type: 'string' },
      { name: '_tokenAmount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
];

const NFT_MANAGER_ABI = [
  {
    name: 'mintNFT',
    type: 'function',
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_uri', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'burnNFT',
    type: 'function',
    inputs: [{ name: '_tokenId', type: 'uint256' }],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'evolveNFT',
    type: 'function',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_newUri', type: 'string' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: '_owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
    stateMutability: 'view',
  },
];

const BADGE_SYSTEM_ABI = [
  {
    name: 'awardBadge',
    type: 'function',
    inputs: [
      { name: '_user', type: 'address' },
      { name: '_badgeId', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getBadges',
    type: 'function',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ name: 'badgeIds', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    name: 'getBadgeMetadata',
    type: 'function',
    inputs: [{ name: '_badgeId', type: 'uint256' }],
    outputs: [{ name: 'metadata', type: 'tuple', components: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'icon', type: 'string' },
      { name: 'rarity', type: 'uint8' },
    ]}],
    stateMutability: 'view',
  },
];

// ===== CONFIGURATION =====
const CONFIG = {
  CONTRACTS: {
    MISSION_TRACKER: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    NFT_MANAGER: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    BADGE_SYSTEM: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  },
  IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
};

// ===== MISSION TRACKER =====
export class MissionTracker {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer: ethers.Signer;

  constructor(provider: ethers.Provider, signer: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract(
      CONFIG.CONTRACTS.MISSION_TRACKER,
      MISSION_TRACKER_ABI,
      signer
    );
  }

  /**
   * Complete a mission with proof
   */
  async completeMission(
    missionId: string,
    proof: string
  ): Promise<{ success: boolean; txHash: string }> {
    try {
      console.log(`🎯 Completing mission: ${missionId}`);

      const proofBytes = ethers.toBeHex(proof);
      const tx = await this.contract.completeMission(missionId, proofBytes);

      const receipt = await tx.wait();
      console.log(`✅ Mission completed:`, receipt?.hash);

      return {
        success: true,
        txHash: receipt?.hash || '',
      };
    } catch (error) {
      console.error('Mission completion error:', error);
      throw new Error(`Failed to complete mission: ${error}`);
    }
  }

  /**
   * Verify if a user has completed a mission
   */
  async verifyCompletion(userAddress: string, missionId: string): Promise<boolean> {
    try {
      const completed = await this.contract.verifyCompletion(userAddress, missionId);
      return completed;
    } catch (error) {
      console.error('Verification error:', error);
      return false;
    }
  }

  /**
   * Get mission metadata from IPFS
   */
  async getMissionMetadata(missionId: string): Promise<Mission | null> {
    try {
      const ipfsUri = await this.contract.getMissionMetadata(missionId);
      if (!ipfsUri) return null;

      const cid = ipfsUri.replace('ipfs://', '');
      const response = await fetch(`${CONFIG.IPFS_GATEWAY}${cid}`);
      const metadata = await response.json();

      return {
        id: missionId,
        ...metadata,
      };
    } catch (error) {
      console.error('Metadata fetch error:', error);
      return null;
    }
  }

  /**
   * Reward user for mission completion
   */
  async rewardUser(
    userAddress: string,
    missionId: string,
    tokenAmount: string
  ): Promise<string> {
    try {
      console.log(`🎁 Rewarding ${userAddress} for mission ${missionId}`);

      const amount = ethers.parseEther(tokenAmount);
      const tx = await this.contract.rewardUser(userAddress, missionId, amount);

      const receipt = await tx.wait();
      console.log(`✅ Reward distributed:`, receipt?.hash);

      return receipt?.hash || '';
    } catch (error) {
      console.error('Reward distribution error:', error);
      throw new Error(`Failed to reward user: ${error}`);
    }
  }

  /**
   * Create a new mission (for admins)
   */
  async createMission(mission: Mission): Promise<string> {
    try {
      // Upload metadata to IPFS first
      const ipfsUri = await this.uploadMissionMetadata(mission);

      // Create mission on-chain
      // This would be a custom function on the contract
      console.log(`📝 Mission created with metadata at ${ipfsUri}`);

      return ipfsUri;
    } catch (error) {
      console.error('Mission creation error:', error);
      throw new Error(`Failed to create mission: ${error}`);
    }
  }

  private async uploadMissionMetadata(mission: Mission): Promise<string> {
    // Upload to IPFS via Pinata
    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PINATA_JWT}`,
      },
      body: JSON.stringify(mission),
    });

    const data = await response.json() as { IpfsHash: string };
    return `ipfs://${data.IpfsHash}`;
  }
}

// ===== NFT MANAGER =====
export class NFTManager {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer: ethers.Signer;

  constructor(provider: ethers.Provider, signer: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract(
      CONFIG.CONTRACTS.NFT_MANAGER,
      NFT_MANAGER_ABI,
      signer
    );
  }

  /**
   * Mint a new NFT
   */
  async mintNFT(to: string, uri: string): Promise<{ tokenId: string; txHash: string }> {
    try {
      console.log(`🖼️ Minting NFT to ${to}`);

      const tx = await this.contract.mintNFT(to, uri);
      const receipt = await tx.wait();

      // Extract tokenId from logs
      const iface = new ethers.Interface(NFT_MANAGER_ABI);
      const logs = receipt?.logs || [];
      let tokenId = '0';

      for (const log of logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'Transfer') {
            tokenId = parsed.args[2].toString();
            break;
          }
        } catch (e) {
          // Skip logs that don't match the interface
        }
      }

      console.log(`✅ NFT minted:`, tokenId);

      return {
        tokenId,
        txHash: receipt?.hash || '',
      };
    } catch (error) {
      console.error('NFT mint error:', error);
      throw new Error(`Failed to mint NFT: ${error}`);
    }
  }

  /**
   * Evolve an existing NFT
   */
  async evolveNFT(tokenId: string, newUri: string): Promise<string> {
    try {
      console.log(`🔄 Evolving NFT #${tokenId}`);

      const tx = await this.contract.evolveNFT(tokenId, newUri);
      const receipt = await tx.wait();

      console.log(`✅ NFT evolved:`, receipt?.hash);

      return receipt?.hash || '';
    } catch (error) {
      console.error('NFT evolution error:', error);
      throw new Error(`Failed to evolve NFT: ${error}`);
    }
  }

  /**
   * Get user's NFT balance
   */
  async getBalance(userAddress: string): Promise<number> {
    try {
      const balance = await this.contract.balanceOf(userAddress);
      return Number(balance);
    } catch (error) {
      console.error('Balance check error:', error);
      return 0;
    }
  }

  /**
   * Get NFT metadata from IPFS
   */
  async getNFTMetadata(uri: string): Promise<NFTCard | null> {
    try {
      const cid = uri.replace('ipfs://', '');
      const response = await fetch(`${CONFIG.IPFS_GATEWAY}${cid}`);
      const metadata = await response.json();
      return metadata;
    } catch (error) {
      console.error('NFT metadata fetch error:', error);
      return null;
    }
  }
}

// ===== BADGE SYSTEM =====
export class BadgeSystem {
  private contract: ethers.Contract;
  private provider: ethers.Provider;
  private signer: ethers.Signer;

  constructor(provider: ethers.Provider, signer: ethers.Signer) {
    this.provider = provider;
    this.signer = signer;
    this.contract = new ethers.Contract(
      CONFIG.CONTRACTS.BADGE_SYSTEM,
      BADGE_SYSTEM_ABI,
      signer
    );
  }

  /**
   * Award a badge to a user
   */
  async awardBadge(userAddress: string, badgeId: number): Promise<string> {
    try {
      console.log(`🏅 Awarding badge ${badgeId} to ${userAddress}`);

      const tx = await this.contract.awardBadge(userAddress, badgeId);
      const receipt = await tx.wait();

      console.log(`✅ Badge awarded:`, receipt?.hash);

      return receipt?.hash || '';
    } catch (error) {
      console.error('Badge award error:', error);
      throw new Error(`Failed to award badge: ${error}`);
    }
  }

  /**
   * Get user's badges
   */
  async getUserBadges(userAddress: string): Promise<Badge[]> {
    try {
      const badgeIds = await this.contract.getBadges(userAddress);
      const badges: Badge[] = [];

      for (const badgeId of badgeIds) {
        const metadata = await this.contract.getBadgeMetadata(badgeId);
        badges.push({
          id: badgeId.toString(),
          name: metadata.name,
          description: metadata.description,
          icon: metadata.icon,
          rarity: this.rarityFromNumber(metadata.rarity),
        });
      }

      return badges;
    } catch (error) {
      console.error('Badge fetch error:', error);
      return [];
    }
  }

  /**
   * Check if user has a specific badge
   */
  async hasBadge(userAddress: string, badgeId: number): Promise<boolean> {
    try {
      const badges = await this.getUserBadges(userAddress);
      return badges.some(b => b.id === badgeId.toString());
    } catch (error) {
      console.error('Badge check error:', error);
      return false;
    }
  }

  private rarityFromNumber(num: number): Badge['rarity'] {
    const rarities: Badge['rarity'][] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    return rarities[num] || 'common';
  }
}

// ===== INTEGRATED MISSION SYSTEM =====
export class IntegratedMissionSystem {
  private missionTracker: MissionTracker;
  private nftManager: NFTManager;
  private badgeSystem: BadgeSystem;

  constructor(provider: ethers.Provider, signer: ethers.Signer) {
    this.missionTracker = new MissionTracker(provider, signer);
    this.nftManager = new NFTManager(provider, signer);
    this.badgeSystem = new BadgeSystem(provider, signer);
  }

  /**
   * Complete a mission with full reward chain
   */
  async completeMissionFull(
    missionId: string,
    proof: string,
    userAddress: string,
    rewardTokens: string,
    badgeId?: number
  ): Promise<{
    missionTx: string;
    rewardTx: string;
    badgeTx?: string;
  }> {
    try {
      console.log(`🚀 Starting full mission completion flow for ${missionId}`);

      // 1. Complete mission
      const { txHash: missionTx } = await this.missionTracker.completeMission(missionId, proof);

      // 2. Distribute reward tokens
      const rewardTx = await this.missionTracker.rewardUser(userAddress, missionId, rewardTokens);

      // 3. Award badge if applicable
      let badgeTx: string | undefined;
      if (badgeId) {
        badgeTx = await this.badgeSystem.awardBadge(userAddress, badgeId);
      }

      console.log(`✅ Mission completed with full rewards`);

      return {
        missionTx,
        rewardTx,
        badgeTx,
      };
    } catch (error) {
      console.error('Full mission completion error:', error);
      throw new Error(`Failed to complete mission with rewards: ${error}`);
    }
  }

  /**
   * Get all mission data for a user
   */
  async getUserMissionStatus(
    userAddress: string,
    missionIds: string[]
  ): Promise<Record<string, { completed: boolean; metadata: Mission | null }>> {
    const status: Record<string, { completed: boolean; metadata: Mission | null }> = {};

    for (const missionId of missionIds) {
      const completed = await this.missionTracker.verifyCompletion(userAddress, missionId);
      const metadata = await this.missionTracker.getMissionMetadata(missionId);

      status[missionId] = { completed, metadata };
    }

    return status;
  }

  /**
   * Get complete user profile with NFTs and badges
   */
  async getUserProfile(userAddress: string) {
    const [nftBalance, badges] = await Promise.all([
      this.nftManager.getBalance(userAddress),
      this.badgeSystem.getUserBadges(userAddress),
    ]);

    return {
      address: userAddress,
      nftBalance,
      badges,
      badgeCount: badges.length,
    };
  }
}

// Export instances
export const createMissionSystem = (provider: ethers.Provider, signer: ethers.Signer) => {
  return new IntegratedMissionSystem(provider, signer);
};
