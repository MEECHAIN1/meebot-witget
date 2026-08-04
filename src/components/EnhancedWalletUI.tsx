
import React, { useState } from 'react';
import { useEnhancedWallet } from '../hooks/useEnhancedWallet';
import { 
  ArrowRightIcon,
  ArrowLeftIcon,
  WalletIcon,
  PlusIcon,
  InboxIcon,
  ShieldCheckIcon,
  BoltIcon,
  FingerPrintIcon,
  UserGroupIcon,
  DocumentDuplicateIcon,
  CheckIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline';

interface EnhancedWalletUIProps {
  web3AuthClientId: string;
  onMintSuccess?: (txHash: string) => void;
  onMissionComplete?: (missionId: string, walletAddress: string) => void;
  onAccountChange?: (address: string | null) => void;
}

export const EnhancedWalletUI: React.FC<EnhancedWalletUIProps> = ({
  web3AuthClientId,
  onMintSuccess,
  onMissionComplete,
  onAccountChange,
}) => {
  const wallet = useEnhancedWallet(web3AuthClientId);
  const [activeTab, setActiveTab] = useState<'wallets' | 'send' | 'recovery' | 'missions'>('wallets');
  
  // Sync account state to parent
  React.useEffect(() => {
    if (onAccountChange) {
      onAccountChange(wallet.activeWallet?.address || null);
    }
  }, [wallet.activeWallet?.address, onAccountChange]);
  const [showCreateWallet, setShowCreateWallet] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [walletType, setWalletType] = useState<'main' | 'savings' | 'dev'>('main');
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [isGasless, setIsGasless] = useState(false);
  const [gaslessQuote, setGaslessQuote] = useState<any>(null);

  // ===== HANDLERS =====

  const handleCreateWallet = async () => {
    try {
      await wallet.createWallet(newWalletName || `Wallet ${wallet.wallets.length + 1}`, walletType);
      setNewWalletName('');
      setShowCreateWallet(false);
    } catch (error) {
      console.error('Create wallet error:', error);
    }
  };

  const handleSendTransaction = async () => {
    try {
      if (!sendTo || !sendAmount) {
        wallet.clearError();
        return;
      }

      const txHash = isGasless
        ? await wallet.sendGaslessTransaction(sendTo, sendAmount)
        : await wallet.sendTransaction(sendTo, sendAmount);

      onMintSuccess?.(txHash);
      setSendTo('');
      setSendAmount('');
      alert(`✅ Transaction sent: ${txHash}`);
    } catch (error) {
      console.error('Send error:', error);
    }
  };

  const handleCheckGasless = async () => {
    try {
      if (!wallet.activeWallet) return;
      const quote = await wallet.checkGaslessEligibility(wallet.activeWallet.id);
      setGaslessQuote(quote);
    } catch (error) {
      console.error('Gasless check error:', error);
    }
  };

  const handleSetupSocialRecovery = async (email: string) => {
    try {
      if (!wallet.activeWallet) return;
      await wallet.setupSocialRecovery(wallet.activeWallet.id, email);
      alert('✅ Social recovery configured');
    } catch (error) {
      console.error('Social recovery error:', error);
    }
  };

  const handleSetupBiometric = async () => {
    try {
      if (!wallet.activeWallet) return;
      const success = await wallet.setupBiometricRecovery(wallet.activeWallet.id);
      if (success) {
        alert('✅ Biometric recovery enabled');
      } else {
        alert('❌ Biometric not supported on this device');
      }
    } catch (error) {
      console.error('Biometric error:', error);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const truncateAddress = (address: string | undefined | null) => {
    if (!address) return '0x...';
    const addrStr = String(address);
    if (addrStr.length < 10) return addrStr;
    return `${addrStr.slice(0, 6)}...${addrStr.slice(-4)}`;
  };

  // ===== RENDER =====

  if (!wallet.isInitialized) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-900/50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <WalletIcon className="w-8 h-8 text-sky-500 mx-auto" />
          </div>
          <p className="text-slate-400">Initializing wallet...</p>
        </div>
      </div>
    );
  }

  if (!wallet.isConnected) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-8 text-center">
        <WalletIcon className="w-16 h-16 mx-auto mb-4 text-sky-500" />
        <h2 className="text-2xl font-bold text-slate-100 mb-2">MeeChain Wallet</h2>
        <p className="text-slate-400 mb-6">
          Secure, modular wallet with Account Abstraction support
        </p>
        <button
          onClick={wallet.login}
          disabled={wallet.isLoading}
          className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 text-white px-8 py-3 rounded-lg font-semibold flex items-center gap-2 mx-auto transition-colors"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          {wallet.isLoading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
      {/* HEADER */}
      <div className="bg-slate-900/50 p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600/20 rounded-full flex items-center justify-center">
               <WalletIcon className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">MeeChain Wallet</h1>
              <p className="text-sm text-slate-400">{wallet.userEmail}</p>
            </div>
          </div>
          <button
            onClick={wallet.logout}
            className="text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 transition-colors border border-slate-700 hover:border-red-400/30"
          >
            <ArrowLeftOnRectangleIcon className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* ACTIVE WALLET DISPLAY */}
        {wallet.activeWallet && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-bold">Active Wallet</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-lg text-white">{wallet.activeWallet.name}</div>
                <div className="font-mono text-xs text-sky-400 flex items-center gap-2 mt-1">
                  {truncateAddress(wallet.activeWallet.address)}
                  <button
                    onClick={() => copyAddress(wallet.activeWallet!.address)}
                    className="hover:bg-slate-800 p-1 rounded transition-colors"
                  >
                    {copiedAddress === wallet.activeWallet.address ? (
                      <CheckIcon className="w-3 h-3" />
                    ) : (
                      <DocumentDuplicateIcon className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase">Balance</div>
                <div className="text-2xl font-bold text-white">{wallet.activeWallet.balance.native} ROSE</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ERROR ALERT */}
      {wallet.error && (
        <div className="bg-red-900/20 border-l-4 border-red-500 p-4 text-red-400 m-4 rounded">
          <p className="font-semibold text-sm">Error</p>
          <p className="text-xs mt-1">{wallet.error}</p>
          <button
            onClick={wallet.clearError}
            className="mt-2 text-xs font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TABS */}
      <div className="border-b border-slate-700 flex overflow-x-auto">
        {(['wallets', 'send', 'recovery', 'missions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 px-6 font-semibold text-center transition-colors whitespace-nowrap text-sm flex items-center justify-center gap-2 ${
              activeTab === tab
                ? 'border-b-2 border-sky-500 text-sky-400 bg-sky-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab === 'wallets' && <InboxIcon className="w-4 h-4" />}
            {tab === 'send' && <ArrowRightIcon className="w-4 h-4" />}
            {tab === 'recovery' && <ShieldCheckIcon className="w-4 h-4" />}
            {tab === 'missions' && <BoltIcon className="w-4 h-4" />}
            {(tab || '').charAt(0).toUpperCase() + (tab || '').slice(1)}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div className="p-6">
        {/* WALLETS TAB */}
        {activeTab === 'wallets' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wallet.wallets.map(w => (
                <div
                  key={w.id}
                  onClick={() => wallet.selectWallet(w.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    wallet.activeWallet?.id === w.id
                      ? 'border-sky-500 bg-sky-500/5 shadow-lg shadow-sky-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{w.name}</h3>
                      <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-800 px-2 py-1 rounded">
                        {w.type}
                      </span>
                    </div>
                    {!w.isDeployed && (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
                        AA Vault
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-slate-500 break-all mb-2">
                    {truncateAddress(w.address)}
                  </p>
                  <div className="text-sm text-slate-300 font-bold">
                    {w.balance.native} ROSE
                  </div>
                </div>
              ))}
            </div>

            {/* CREATE WALLET */}
            <div className="bg-slate-900/30 rounded-lg p-4 border-2 border-dashed border-slate-700">
              {!showCreateWallet ? (
                <button
                  onClick={() => setShowCreateWallet(true)}
                  className="w-full text-slate-400 hover:text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  New Vault
                </button>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Vault Name (e.g., Cold Storage)"
                    value={newWalletName}
                    onChange={e => setNewWalletName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                  />
                  <select
                    value={walletType}
                    onChange={e => setWalletType(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                  >
                    <option value="main">Main</option>
                    <option value="savings">Savings</option>
                    <option value="dev">Development</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateWallet}
                      className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-lg transition-colors text-sm"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowCreateWallet(false)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-2 rounded-lg transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SEND TAB */}
        {activeTab === 'send' && (
          <div className="space-y-6 max-w-md mx-auto">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={sendTo}
                onChange={e => setSendTo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Amount (ROSE)
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={sendAmount}
                onChange={e => setSendAmount(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
              />
            </div>

            {/* GASLESS TOGGLE */}
            <div className="bg-sky-500/5 rounded-lg p-4 border border-sky-500/20">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGasless}
                  onChange={e => {
                    setIsGasless(e.target.checked);
                    if (e.target.checked) handleCheckGasless();
                  }}
                  className="w-4 h-4 rounded border-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-800 bg-slate-900"
                />
                <div>
                  <div className="font-bold text-sm text-slate-200 flex items-center gap-2">
                    <BoltIcon className="w-4 h-4 text-amber-500" />
                    Gasless Mode
                  </div>
                  {gaslessQuote && (
                    <div className="text-[10px] text-slate-500 mt-1">
                      {gaslessQuote.eligible
                        ? `✅ Sponsored by ${gaslessQuote.sponsorName} (${gaslessQuote.dailyTransactionsRemaining} left)`
                        : `❌ ${gaslessQuote.reason}`}
                    </div>
                  )}
                </div>
              </label>
            </div>

            <button
              onClick={handleSendTransaction}
              disabled={wallet.isLoading || !sendTo || !sendAmount}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowRightIcon className="w-5 h-5" />
              {wallet.isLoading ? 'Processing...' : 'Execute Transaction'}
            </button>
          </div>
        )}

        {/* RECOVERY TAB */}
        {activeTab === 'recovery' && wallet.activeWallet && (
          <div className="space-y-6 max-w-md mx-auto">
            <div className="bg-sky-500/5 rounded-lg p-4 border border-sky-500/10">
              <h3 className="font-bold text-slate-200 mb-2">Social & Biometric Security</h3>
              <p className="text-xs text-slate-400">
                Oasis Sapphire Privacy-preserving recovery mechanisms.
              </p>
            </div>

            {/* SOCIAL RECOVERY */}
            <div className="border border-slate-700 rounded-lg p-4 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-sky-400" />
                Social Backup
              </h4>
              <input
                type="email"
                placeholder="guardian@example.com"
                onBlur={e => {
                  if (e.target.value) handleSetupSocialRecovery(e.target.value);
                }}
                className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-sm"
              />
              <p className="text-[10px] text-slate-500">
                Register a trusted email for encrypted on-chain recovery.
              </p>
            </div>

            {/* BIOMETRIC RECOVERY */}
            <div className="border border-slate-700 rounded-lg p-4 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <FingerPrintIcon className="w-5 h-5 text-sky-400" />
                Passkey Verification
              </h4>
              <button
                onClick={handleSetupBiometric}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-colors text-sm"
              >
                {wallet.activeWallet.recoveryConfig?.biometricEnabled
                  ? '✓ Securely Linked'
                  : 'Link Device Biometrics'}
              </button>
            </div>

            {/* GUARDIAN RECOVERY */}
            <div className="border border-slate-700 rounded-lg p-4 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <UserGroupIcon className="w-5 h-5 text-sky-400" />
                Multi-Guardian Setup
              </h4>
              <button className="w-full border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 font-bold py-2 rounded-lg transition-colors text-sm">
                Configure Guardians
              </button>
            </div>
          </div>
        )}

        {/* MISSIONS TAB */}
        {activeTab === 'missions' && (
          <div className="text-center py-10 space-y-4">
            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
              <BoltIcon className="w-10 h-10 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-white">MeeChain Quests</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Complete on-chain activities to unlock badges and gas rewards.
            </p>
            <button className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-2 rounded-lg transition-colors text-sm">
              Explore Missions
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedWalletUI;
