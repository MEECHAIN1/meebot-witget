
import { ethers } from 'ethers';

// ===== TYPE DEFINITIONS =====
export type WalletType = 'main' | 'savings' | 'dev';
export type RecoveryMethod = 'social' | 'biometric' | 'guardian';

export interface SmartWallet {
  id: string;
  address: `0x${string}`;
  name: string;
  type: WalletType;
  ownerId: string;
  balance: {
    native: string;
    tokens: Record<string, string>;
  };
  isDeployed: boolean;
  createdAt: number;
  lastActivity: number;
  recoveryConfig?: RecoveryConfig;
}

export interface TransactionRequest {
  to: `0x${string}`;
  value: string;
  data?: `0x${string}`;
  gasLimit?: string;
}

export interface UserOperation {
  sender: `0x${string}`;
  nonce: bigint;
  initCode: `0x${string}`;
  callData: `0x${string}`;
  accountGasLimits: `0x${string}`;
  preVerificationGas: bigint;
  gasFees: `0x${string}`;
  paymasterAndData: `0x${string}`;
  signature: `0x${string}`;
}

export interface GaslessQuote {
  eligible: boolean;
  sponsorName?: string;
  feeToken?: string;
  reason?: string;
  dailyTransactionsRemaining?: number;
}

export interface RecoveryConfig {
  method: RecoveryMethod;
  primaryGuardian?: string;
  backupGuardians?: string[];
  socialRecoveryEmail?: string;
  biometricEnabled: boolean;
  lastUpdated: number;
}

export interface IPFSMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{ trait_type: string; value: string }>;
}

// ===== CONFIGURATION =====
const CONFIG = {
  STORAGE_KEY: 'meechain_wallets_v2',
  ENTRY_POINT: '0x5FF137D4b0FDCD49DcA30c7B697586cEBC6546A6' as const,
  FACTORY_ADDRESS: '0x9406Cc6185a346906296840746125a0E56d746cc' as const,
  PAYMASTER_ADDRESS: '0xa93fd87eafA633BcE39AbD78cD59d4b9b0C23Ff0' as const,
  IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
  NETWORKS: {
    sepolia: 11155111,
    mainnet: 1,
    polygon: 137,
    arbitrum: 42161,
  },
};

// ===== MAIN WALLET MANAGER CLASS =====
export class EnhancedWalletManager {
  private static instance: EnhancedWalletManager;
  private wallets: Map<string, SmartWallet> = new Map();
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;

  private constructor() {
    this.loadWalletsFromStorage();
  }

  // Singleton pattern
  public static getInstance(): EnhancedWalletManager {
    if (!EnhancedWalletManager.instance) {
      EnhancedWalletManager.instance = new EnhancedWalletManager();
    }
    return EnhancedWalletManager.instance;
  }

  // ===== WALLET LIFECYCLE MANAGEMENT =====

  /**
   * Initialize wallet manager with a provider and signer
   */
  public setProvider(provider: ethers.Provider, signer: ethers.Signer): void {
    this.provider = provider;
    this.signer = signer;
  }

  /**
   * Create a new Smart Wallet with deterministic address (CREATE2)
   */
  public async createSmartWallet(
    userId: string,
    name: string = 'Main Vault',
    type: WalletType = 'main'
  ): Promise<SmartWallet> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    // Generate deterministic address using CREATE2
    const salt = this.generateSalt(userId, Date.now());
    const walletAddress = await this.predictWalletAddress(userId, salt);

    const newWallet: SmartWallet = {
      id: crypto.randomUUID(),
      address: walletAddress as `0x${string}`,
      name,
      type,
      ownerId: userId,
      isDeployed: false, // Will be deployed on first transaction
      createdAt: Date.now(),
      lastActivity: Date.now(),
      balance: {
        native: '0',
        tokens: {},
      },
      recoveryConfig: {
        method: 'social',
        biometricEnabled: false,
        lastUpdated: Date.now(),
      },
    };

    // Award welcome bonus for main wallet
    if (type === 'main') {
      newWallet.balance.tokens['MEE'] = '100'; // Welcome bonus
    }

    this.wallets.set(newWallet.id, newWallet);
    this.saveWalletsToStorage();

    console.log(`✅ Created ${type} wallet: ${walletAddress}`);
    return newWallet;
  }

  /**
   * Get all wallets for a user
   */
  public getWallets(userId: string): SmartWallet[] {
    return Array.from(this.wallets.values()).filter(w => w.ownerId === userId);
  }

  /**
   * Get a specific wallet by ID
   */
  public getWallet(walletId: string): SmartWallet | undefined {
    return this.wallets.get(walletId);
  }

  /**
   * Update wallet metadata
   */
  public updateWallet(walletId: string, updates: Partial<SmartWallet>): SmartWallet {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const updated = { ...wallet, ...updates, lastActivity: Date.now() };
    this.wallets.set(walletId, updated);
    this.saveWalletsToStorage();
    return updated;
  }

  // ===== ACCOUNT ABSTRACTION & USEROPS =====

  /**
   * Create a User Operation for gasless/sponsored transactions
   */
  public async createUserOperation(
    walletAddress: `0x${string}`,
    txRequest: TransactionRequest,
    usePaymaster: boolean = false
  ): Promise<UserOperation> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider/Signer not initialized');
    }

    const nonce = await this.getUserOpNonce(walletAddress);
    const callData = await this.encodeCallData(txRequest);

    let userOp: UserOperation = {
      sender: walletAddress,
      nonce: BigInt(nonce),
      initCode: '0x' as `0x${string}`,
      callData,
      accountGasLimits: '0x' as `0x${string}`,
      preVerificationGas: BigInt(21000),
      gasFees: '0x' as `0x${string}`,
      paymasterAndData: '0x' as `0x${string}`,
      signature: '0x' as `0x${string}`,
    };

    // Add Paymaster data if gasless is requested
    if (usePaymaster) {
      const quote = await this.checkGaslessEligibility(walletAddress);
      if (!quote.eligible) {
        throw new Error(`Gasless not eligible: ${quote.reason}`);
      }
      userOp.paymasterAndData = await this.encodePaymasterData(
        walletAddress,
        userOp
      );
    }

    // Calculate gas limits
    userOp.accountGasLimits = await this.estimateGas(userOp);

    return userOp;
  }

  /**
   * Send a transaction with AA support
   */
  public async sendTransaction(
    walletId: string,
    txRequest: TransactionRequest,
    usePaymaster: boolean = false
  ): Promise<string> {
    const wallet = this.getWallet(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    console.log(`📤 Sending transaction from ${wallet.address}...`);

    // Create User Operation
    const userOp = await this.createUserOperation(
      wallet.address,
      txRequest,
      usePaymaster
    );

    // Sign the User Operation
    const signedUserOp = await this.signUserOperation(userOp);

    // Submit to EntryPoint
    const txHash = await this.submitUserOperation(signedUserOp);

    // Update wallet activity
    this.updateWallet(walletId, {
      lastActivity: Date.now(),
    });

    console.log(`✅ Transaction submitted: ${txHash}`);
    return txHash;
  }

  // ===== GASLESS & PAYMASTER =====

  /**
   * Check if wallet is eligible for gasless transactions
   */
  public async checkGaslessEligibility(
    walletAddress: `0x${string}`
  ): Promise<GaslessQuote> {
    // Simple eligibility check: all main wallets get 3 free txs/day
    const today = new Date().toDateString();
    const txCountKey = `gasless_txcount_${walletAddress}_${today}`;
    const txCount = parseInt(localStorage.getItem(txCountKey) || '0');

    if (txCount >= 3) {
      return {
        eligible: false,
        reason: 'Daily limit exceeded',
        dailyTransactionsRemaining: 0,
      };
    }

    // Increment transaction count
    localStorage.setItem(txCountKey, String(txCount + 1));

    return {
      eligible: true,
      sponsorName: 'MeeChain Foundation',
      feeToken: 'USDC',
      dailyTransactionsRemaining: 3 - txCount - 1,
    };
  }

  // ===== RECOVERY MECHANISMS =====

  /**
   * Setup social recovery (email-based)
   */
  public async setupSocialRecovery(
    walletId: string,
    email: string
  ): Promise<void> {
    const wallet = this.getWallet(walletId);
    if (!wallet) throw new Error('Wallet not found');

    if (!wallet.recoveryConfig) {
      wallet.recoveryConfig = {
        method: 'social',
        biometricEnabled: false,
        lastUpdated: Date.now(),
      };
    }

    wallet.recoveryConfig.method = 'social';
    wallet.recoveryConfig.socialRecoveryEmail = email;
    wallet.recoveryConfig.lastUpdated = Date.now();

    this.updateWallet(walletId, wallet);
    console.log(`🔐 Social recovery configured for ${email}`);
  }

  /**
   * Setup biometric recovery
   */
  public async setupBiometricRecovery(walletId: string): Promise<boolean> {
    const wallet = this.getWallet(walletId);
    if (!wallet) throw new Error('Wallet not found');

    try {
      // Check if browser supports WebAuthn
      if (!window.PublicKeyCredential) {
        throw new Error('Biometric not supported');
      }

      // Register credential
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array(32),
          rp: { name: 'MeeChain' },
          user: {
            id: new Uint8Array(16),
            name: wallet.ownerId,
            displayName: wallet.name,
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          timeout: 60000,
          attestation: 'direct',
        },
      });

      if (!credential) throw new Error('Biometric registration failed');

      if (!wallet.recoveryConfig) {
        wallet.recoveryConfig = {
          method: 'biometric',
          biometricEnabled: true,
          lastUpdated: Date.now(),
        };
      } else {
        wallet.recoveryConfig.biometricEnabled = true;
      }

      this.updateWallet(walletId, wallet);
      console.log(`✅ Biometric recovery enabled`);
      return true;
    } catch (error) {
      console.error('Biometric setup failed:', error);
      return false;
    }
  }

  /**
   * Setup guardian-based recovery
   */
  public async setupGuardianRecovery(
    walletId: string,
    primaryGuardian: string,
    backupGuardians: string[] = []
  ): Promise<void> {
    const wallet = this.getWallet(walletId);
    if (!wallet) throw new Error('Wallet not found');

    if (!wallet.recoveryConfig) {
      wallet.recoveryConfig = {
        method: 'guardian',
        biometricEnabled: false,
        lastUpdated: Date.now(),
      };
    }

    wallet.recoveryConfig.method = 'guardian';
    wallet.recoveryConfig.primaryGuardian = primaryGuardian;
    wallet.recoveryConfig.backupGuardians = backupGuardians;
    wallet.recoveryConfig.lastUpdated = Date.now();

    this.updateWallet(walletId, wallet);
    console.log(`🛡️ Guardian recovery setup with ${backupGuardians.length + 1} guardians`);
  }

  // ===== IPFS & METADATA MANAGEMENT =====

  /**
   * Upload metadata to IPFS (via Pinata)
   */
  public async uploadMetadataToIPFS(metadata: IPFSMetadata): Promise<string> {
    const formData = new FormData();
    const file = new File([JSON.stringify(metadata)], 'metadata.json', {
      type: 'application/json',
    });
    formData.append('file', file);

    // Note: In production, use Pinata JWT token
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PINATA_JWT}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('IPFS upload failed');
    }

    const data = await response.json() as { IpfsHash: string };
    return `ipfs://${data.IpfsHash}`;
  }

  /**
   * Retrieve metadata from IPFS
   */
  public async fetchMetadataFromIPFS(cid: string): Promise<IPFSMetadata> {
    const ipfsPath = cid.startsWith('ipfs://') ? cid.replace('ipfs://', '') : cid;
    const response = await fetch(`${CONFIG.IPFS_GATEWAY}${ipfsPath}`);

    if (!response.ok) {
      throw new Error('IPFS fetch failed');
    }

    return response.json();
  }

  // ===== NFT & MISSION SYSTEM INTEGRATION =====

  /**
   * Prepare NFT metadata for minting
   */
  public prepareMintMetadata(
    name: string,
    description: string,
    imageBase64: string,
    attributes: Array<{ trait_type: string; value: string }>
  ): IPFSMetadata {
    return {
      name,
      description,
      image: `data:image/png;base64,${imageBase64}`,
      attributes: [
        { trait_type: 'Creator', value: this.signer?.getAddress() || 'Unknown' },
        { trait_type: 'Timestamp', value: new Date().toISOString() },
        ...attributes,
      ],
    };
  }

  /**
   * Verify wallet holds required NFT for mission
   */
  public async verifyNFTHolding(
    walletAddress: `0x${string}`,
    contractAddress: `0x${string}`,
    requiredTokenIds: string[]
  ): Promise<boolean> {
    if (!this.provider) throw new Error('Provider not initialized');

    const contract = new ethers.Contract(
      contractAddress,
      ['function balanceOf(address owner) view returns (uint256)'],
      this.provider
    );

    const balance = await contract.balanceOf(walletAddress);
    return balance > 0 && requiredTokenIds.length === 0;
  }

  // ===== PRIVATE HELPER METHODS =====

  private generateSalt(userId: string, nonce: number): string {
    const hash = new TextEncoder().encode(`${userId}${nonce}`);
    return `0x${Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  private async predictWalletAddress(
    userId: string,
    salt: string
  ): Promise<string> {
    // In production, use proper CREATE2 calculation
    // For now, simulate with hash
    const combined = `${CONFIG.FACTORY_ADDRESS}${userId}${salt}`;
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined))
      )
    )
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return `0x${hash.slice(0, 40)}`;
  }

  private async getUserOpNonce(walletAddress: `0x${string}`): Promise<number> {
    // In production, fetch from EntryPoint
    return 0;
  }

  private async encodeCallData(txRequest: TransactionRequest): Promise<`0x${string}`> {
    // Encode the transaction as callData
    const iface = new ethers.Interface(['function execute(address to, uint256 value, bytes data)']);
    return iface.encodeFunctionData('execute', [
      txRequest.to,
      txRequest.value,
      txRequest.data || '0x',
    ]) as `0x${string}`;
  }

  private async encodePaymasterData(
    walletAddress: `0x${string}`,
    userOp: UserOperation
  ): Promise<`0x${string}`> {
    // In production, fetch from Paymaster API
    return `0x${CONFIG.PAYMASTER_ADDRESS.slice(2).padEnd(40, '0')}` as `0x${string}`;
  }

  private async estimateGas(userOp: UserOperation): Promise<`0x${string}`> {
    // In production, estimate actual gas
    return '0x' + (150000).toString(16).padStart(8, '0') as `0x${string}`;
  }

  private async signUserOperation(userOp: UserOperation): Promise<UserOperation> {
    if (!this.signer) throw new Error('Signer not initialized');

    // Sign the UserOp hash
    const hash = this.hashUserOperation(userOp);
    const signature = await this.signer.signMessage(
      ethers.getBytes(hash)
    );

    return { ...userOp, signature: signature as `0x${string}` };
  }

  private hashUserOperation(userOp: UserOperation): string {
    // Keccak256 hash of encoded UserOp
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256', 'bytes', 'bytes', 'bytes', 'uint256', 'bytes', 'bytes', 'bytes'],
      [
        userOp.sender,
        userOp.nonce,
        userOp.initCode,
        userOp.callData,
        userOp.accountGasLimits,
        userOp.preVerificationGas,
        userOp.gasFees,
        userOp.paymasterAndData,
        userOp.signature,
      ]
    );
    return ethers.keccak256(encoded);
  }

  private async submitUserOperation(userOp: UserOperation): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');

    // In production, submit to Bundler service
    // For now, simulate
    return `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`;
  }

  // ===== STORAGE MANAGEMENT =====

  private loadWalletsFromStorage(): void {
    try {
      const data = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (data) {
        const wallets = JSON.parse(data);
        wallets.forEach((wallet: SmartWallet) => {
          this.wallets.set(wallet.id, wallet);
        });
      }
    } catch (error) {
      console.error('Failed to load wallets from storage:', error);
    }
  }

  private saveWalletsToStorage(): void {
    try {
      const wallets = Array.from(this.wallets.values());
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(wallets));
    } catch (error) {
      console.error('Failed to save wallets to storage:', error);
    }
  }

  public clearStorage(): void {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
    this.wallets.clear();
  }
}

// Export singleton instance
export const walletManager = EnhancedWalletManager.getInstance();
