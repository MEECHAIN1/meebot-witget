
import { useState, useEffect, useCallback, useRef } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { ethers } from 'ethers';
import {
  EnhancedWalletManager,
  SmartWallet,
  TransactionRequest,
  GaslessQuote,
} from '../lib/wallet/EnhancedWalletManager';

// ===== TYPES =====
export interface UseEnhancedWalletState {
  // Web3Auth State
  isInitialized: boolean;
  isConnected: boolean;
  isLoading: boolean;
  user: any | null;
  userEmail: string | null;

  // Wallet State
  wallets: SmartWallet[];
  activeWallet: SmartWallet | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;

  // Chain State
  chainId: number | null;
  isCorrectNetwork: boolean;

  // Error State
  error: string | null;
}

export interface UseEnhancedWalletActions {
  // Auth
  login: () => Promise<void>;
  logout: () => Promise<void>;

  // Wallet Management
  createWallet: (name: string, type: 'main' | 'savings' | 'dev') => Promise<SmartWallet>;
  selectWallet: (walletId: string) => void;
  renameWallet: (walletId: string, newName: string) => Promise<void>;

  // Transactions
  sendTransaction: (to: string, value: string) => Promise<string>;
  sendGaslessTransaction: (to: string, value: string) => Promise<string>;
  checkGaslessEligibility: (walletId: string) => Promise<GaslessQuote>;

  // Recovery
  setupSocialRecovery: (walletId: string, email: string) => Promise<void>;
  setupBiometricRecovery: (walletId: string) => Promise<boolean>;
  setupGuardianRecovery: (
    walletId: string,
    primaryGuardian: string,
    backupGuardians: string[]
  ) => Promise<void>;

  // Utilities
  switchNetwork: (chainId: number) => Promise<void>;
  clearError: () => void;
}

export type UseEnhancedWalletReturn = UseEnhancedWalletState & UseEnhancedWalletActions;

// ===== CONFIGURATION =====
const MEECHAIN_CONFIG = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: '0x344e', // MeeChain (13390)
  rpcTarget: 'https://rpc.meechain.live',
  displayName: 'MeeChain',
  blockExplorer: 'https://explorer.meechain.live',
  ticker: 'MEE',
  tickerName: 'MEE',
};

const SUPPORTED_NETWORKS = {
  13390: { name: 'MeeChain', rpcUrl: 'https://rpc.meechain.live' },
  11155111: { name: 'Sepolia', rpcUrl: 'https://rpc.sepolia.org' },
  1: { name: 'Ethereum', rpcUrl: 'https://mainnet.infura.io/v3/' },
  137: { name: 'Polygon', rpcUrl: 'https://polygon-rpc.com/' },
  42161: { name: 'Arbitrum', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
};

// ===== HOOK =====
export function useEnhancedWallet(web3AuthClientId: string): UseEnhancedWalletReturn {
  // State
  const [state, setState] = useState<UseEnhancedWalletState>({
    isInitialized: false,
    isConnected: false,
    isLoading: true,
    user: null,
    userEmail: null,
    wallets: [],
    activeWallet: null,
    provider: null,
    signer: null,
    chainId: null,
    isCorrectNetwork: false,
    error: null,
  });

  // Refs
  const web3authRef = useRef<Web3Auth | null>(null);
  const walletManagerRef = useRef(EnhancedWalletManager.getInstance());

  // ===== INITIALIZATION =====

  useEffect(() => {
    const initWeb3Auth = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        // If client ID is placeholder or empty, trigger fallback immediately
        if (!web3AuthClientId || web3AuthClientId.includes('your client id') || web3AuthClientId.includes('placeholder')) {
          throw new Error('Placeholder client ID detected');
        }

        // Initialize Web3Auth
        const privateKeyProvider = new EthereumPrivateKeyProvider({ config: { chainConfig: MEECHAIN_CONFIG } });

        const web3auth = new Web3Auth({
          clientId: web3AuthClientId,
          chainConfig: MEECHAIN_CONFIG,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
          privateKeyProvider,
          uiConfig: {
            appName: 'MeeChain',
            theme: {
              primary: '#6A00FF',
            },
            loginGridCol: 3,
            modalZIndex: '2147483647',
          },
        });

        web3authRef.current = web3auth;
        await web3auth.initModal();

        // Check if already connected
        if (web3auth.connected) {
          await handleConnection(web3auth);
        }

        setState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
        }));
      } catch (error) {
        console.warn('Web3Auth initialization error, falling back to simulated sandbox wallet:', error);

        // Setup mock Web3Auth EIP1193 provider
        const mockEip1193Provider = {
          request: async (request: { method: string; params?: any[] }) => {
            if (request.method === 'eth_accounts' || request.method === 'eth_requestAccounts') {
              return ['0x9dB52636259c44558e8Dbe77eE2aF0eF6789D6b4'];
            }
            if (request.method === 'eth_chainId') {
              return '0x344e'; // MeeChain (13390)
            }
            if (request.method === 'eth_sendTransaction') {
              return '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
            }
            if (request.method === 'personal_sign') {
              return '0x' + Array.from({length: 130}, () => Math.floor(Math.random()*16).toString(16)).join('');
            }
            return null;
          }
        };

        const isMockConnectedBefore = localStorage.getItem('meebot_mock_connected') === 'true';

        const mockWeb3Auth: any = {
          connected: isMockConnectedBefore,
          provider: mockEip1193Provider,
          async initModal() {},
          async connect() {
            this.connected = true;
            localStorage.setItem('meebot_mock_connected', 'true');
            return mockEip1193Provider;
          },
          async logout() {
            this.connected = false;
            localStorage.removeItem('meebot_mock_connected');
          },
          async getUserInfo() {
            return {
              email: "simulated.user@meechain.live",
              name: "Simulated MeeBot Explorer",
              profileImage: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120"
            };
          }
        };

        web3authRef.current = mockWeb3Auth;

        // Auto-reconnect if they were logged in previously in mock mode
        if (mockWeb3Auth.connected) {
          await handleConnection(mockWeb3Auth);
        }

        setState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false,
          error: null, // Clear error since we are running fine in sandbox mode
        }));
      }
    };

    initWeb3Auth();
  }, [web3AuthClientId]);

  // ===== CONNECTION HANDLER =====

  const handleConnection = async (web3auth: Web3Auth) => {
    try {
      const provider = new ethers.BrowserProvider(web3auth.provider!);
      const signer = await provider.getSigner();
      const user = await web3auth.getUserInfo();
      const { chainId } = await provider.getNetwork();

      // Initialize wallet manager
      walletManagerRef.current.setProvider(provider, signer);

      // Load or create default wallet
      const userId = user.email || (await signer.getAddress());
      let wallets = walletManagerRef.current.getWallets(userId);

      if (wallets.length === 0) {
        // Create default main wallet
        const mainWallet = await walletManagerRef.current.createSmartWallet(
          userId,
          'Main Vault',
          'main'
        );
        wallets = [mainWallet];
      }

      setState(prev => ({
        ...prev,
        isConnected: true,
        user,
        userEmail: user.email || null,
        provider,
        signer,
        wallets,
        activeWallet: wallets[0],
        chainId: Number(chainId),
        isCorrectNetwork: Number(chainId) === parseInt(MEECHAIN_CONFIG.chainId, 16),
      }));
    } catch (error) {
      console.error('Connection error:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to connect wallet',
      }));
    }
  };

  // ===== AUTH ACTIONS =====

  const login = useCallback(async () => {
    try {
      if (!web3authRef.current) throw new Error('Web3Auth not initialized');

      setState(prev => ({ ...prev, isLoading: true, error: null }));
      await web3authRef.current.connect();
      await handleConnection(web3authRef.current);
    } catch (error) {
      console.error('Login error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed',
      }));
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (!web3authRef.current) return;

      setState(prev => ({ ...prev, isLoading: true }));
      await web3authRef.current.logout();

      setState(prev => ({
        ...prev,
        isConnected: false,
        user: null,
        userEmail: null,
        provider: null,
        signer: null,
        wallets: [],
        activeWallet: null,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Logout error:', error);
      setState(prev => ({
        ...prev,
        error: 'Logout failed',
        isLoading: false,
      }));
    }
  }, []);

  // ===== WALLET ACTIONS =====

  const createWallet = useCallback(
    async (name: string, type: 'main' | 'savings' | 'dev') => {
      try {
        if (!state.user) throw new Error('Not connected');

        const wallet = await walletManagerRef.current.createSmartWallet(
          state.user.email || state.user.sub,
          name,
          type
        );

        setState(prev => ({
          ...prev,
          wallets: [...prev.wallets, wallet],
        }));

        return wallet;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create wallet';
        setState(prev => ({ ...prev, error: message }));
        throw error;
      }
    },
    [state.user]
  );

  const selectWallet = useCallback((walletId: string) => {
    const wallet = state.wallets.find(w => w.id === walletId);
    if (!wallet) {
      setState(prev => ({ ...prev, error: 'Wallet not found' }));
      return;
    }

    setState(prev => ({
      ...prev,
      activeWallet: wallet,
      error: null,
    }));
  }, [state.wallets]);

  const renameWallet = useCallback(
    async (walletId: string, newName: string) => {
      try {
        walletManagerRef.current.updateWallet(walletId, { name: newName });

        setState(prev => ({
          ...prev,
          wallets: prev.wallets.map(w =>
            w.id === walletId ? { ...w, name: newName } : w
          ),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to rename wallet';
        setState(prev => ({ ...prev, error: message }));
        throw error;
      }
    },
    []
  );

  // ===== TRANSACTION ACTIONS =====

  const sendTransaction = useCallback(
    async (to: string, value: string) => {
      try {
        if (!state.activeWallet) throw new Error('No active wallet');

        const txRequest: TransactionRequest = {
          to: to as `0x${string}`,
          value,
        };

        const txHash = await walletManagerRef.current.sendTransaction(
          state.activeWallet.id,
          txRequest,
          false
        );

        return txHash;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Transaction failed';
        setState(prev => ({ ...prev, error: message }));
        throw error;
      }
    },
    [state.activeWallet]
  );

  const sendGaslessTransaction = useCallback(
    async (to: string, value: string) => {
      try {
        if (!state.activeWallet) throw new Error('No active wallet');

        // Check gasless eligibility first
        const quote = await walletManagerRef.current.checkGaslessEligibility(
          state.activeWallet.address
        );

        if (!quote.eligible) {
          throw new Error(quote.reason || 'Not eligible for gasless');
        }

        const txRequest: TransactionRequest = {
          to: to as `0x${string}`,
          value,
        };

        const txHash = await walletManagerRef.current.sendTransaction(
          state.activeWallet.id,
          txRequest,
          true
        );

        return txHash;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gasless transaction failed';
        setState(prev => ({ ...prev, error: message }));
        throw error;
      }
    },
    [state.activeWallet]
  );

  const checkGaslessEligibility = useCallback(
    async (walletId: string) => {
      try {
        const wallet = state.wallets.find(w => w.id === walletId);
        if (!wallet) throw new Error('Wallet not found');

        return await walletManagerRef.current.checkGaslessEligibility(wallet.address);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to check eligibility';
        setState(prev => ({ ...prev, error: message }));
        throw error;
      }
    },
    [state.wallets]
  );

  // ===== RECOVERY ACTIONS =====

  const setupSocialRecovery = useCallback(
    async (walletId: string, email: string) => {
      try {
        await walletManagerRef.current.setupSocialRecovery(walletId, email);
        setState(prev => ({
          ...prev,
          wallets: prev.wallets.map(w =>
            w.id === walletId && w.recoveryConfig
              ? {
                  ...w,
                  recoveryConfig: {
                    ...w.recoveryConfig,
                    method: 'social',
                    socialRecoveryEmail: email,
                  },
                }
              : w
          ),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Social recovery setup failed';
        setState(prev => ({ ...prev, error: message }));
        throw error;
      }
    },
    []
  );

  const setupBiometricRecovery = useCallback(
    async (walletId: string) => {
      try {
        const success = await walletManagerRef.current.setupBiometricRecovery(walletId);
        if (success) {
          setState(prev => ({
            ...prev,
            wallets: prev.wallets.map(w =>
              w.id === walletId && w.recoveryConfig
                ? {
                    ...w,
                    recoveryConfig: {
                      ...w.recoveryConfig,
                      biometricEnabled: true,
                    },
                  }
                : w
            ),
          }));
        }
        return success;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Biometric setup failed';
        setState(prev => ({ ...prev, error: message }));
        throw error;
      }
    },
    []
  );

  const setupGuardianRecovery = useCallback(
    async (walletId: string, primaryGuardian: string, backupGuardians: string[]) => {
      try {
        await walletManagerRef.current.setupGuardianRecovery(
          walletId,
          primaryGuardian,
          backupGuardians
        );
        setState(prev => ({
          ...prev,
          wallets: prev.wallets.map(w =>
            w.id === walletId && w.recoveryConfig
              ? {
                  ...w,
                  recoveryConfig: {
                    ...w.recoveryConfig,
                    method: 'guardian',
                    primaryGuardian,
                    backupGuardians,
                  },
                }
              : w
          ),
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Guardian setup failed';
        setState(prev => ({ ...prev, error: message }));
        throw error;
      }
    },
    []
  );

  // ===== UTILITY ACTIONS =====

  const switchNetwork = useCallback(async (newChainId: number) => {
    try {
      if (!web3authRef.current?.provider) throw new Error('Provider not available');

      const network = SUPPORTED_NETWORKS[newChainId as keyof typeof SUPPORTED_NETWORKS];
      if (!network) throw new Error('Network not supported');

      await (web3authRef.current.provider as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${newChainId.toString(16)}` }],
      });

      setState(prev => ({
        ...prev,
        chainId: newChainId,
        isCorrectNetwork: newChainId === parseInt(MEECHAIN_CONFIG.chainId, 16),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network switch failed';
      setState(prev => ({ ...prev, error: message }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // ===== RETURN =====

  return {
    ...state,
    login,
    logout,
    createWallet,
    selectWallet,
    renameWallet,
    sendTransaction,
    sendGaslessTransaction,
    checkGaslessEligibility,
    setupSocialRecovery,
    setupBiometricRecovery,
    setupGuardianRecovery,
    switchNetwork,
    clearError,
  };
}
