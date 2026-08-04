
import React, { useState } from 'react';
import { MeeBotDefaultIcon } from './components/Icons';
import MeeBotStation from './src/components/MeeBotStation';
import MeeBotWidget from './src/components/dashboard/MeeBotWidget';
import NFTGallery from './src/components/dashboard/NFTGallery';
import BadgeGallery from './src/components/dashboard/BadgeGallery';
import ProposalGrid from './src/components/dashboard/ProposalGrid';
import MyJourney from './src/components/dashboard/MyJourney';
import ImageEditor from './components/ImageEditor';
import { EnhancedWalletUI } from './src/components/EnhancedWalletUI';
import { addTimelineEvent } from './src/lib/services/journeyService';

const WEB3AUTH_CLIENT_ID = "BA-Q_nI5E0YpXN_8S... (your client id)"; // Assume replaced with actual ID or handled by build

const ConnectWalletPrompt: React.FC<{ onConnect: () => void }> = ({ onConnect }) => (
    <div className="text-center py-20">
        <div className="meebot-avatar meebot-bounce mx-auto" style={{width: '128px', height: '128px'}}>
            <MeeBotDefaultIcon />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-slate-100 mt-6">Welcome to MeeChain</h2>
        <p className="text-slate-400 mt-2 max-w-md mx-auto">
            Experience the future of modular AI with our secure, privacy-preserving Account Abstraction wallet.
        </p>
        <button
            onClick={onConnect}
            className="mt-8 bg-sky-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-sky-500 transition-all text-lg shadow-lg shadow-sky-600/20"
        >
            Connect Secure Wallet
        </button>
    </div>
);

const App: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  // Using the Platform-provided process.env.API_KEY is handled by the Gemini SDK internally.
  // For the wallet, we use the EnhancedWalletUI component which manages its own state via the hook.
  // However, we need to pass some state to child components.

  const [walletConnected, setWalletConnected] = useState(false);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);

  const handleMintSuccess = async (result: { metadata: any; txHash: string; }) => {
    if (!activeAccount) return;
    try {
        await addTimelineEvent({
            type: 'meebot_birth',
            data: { 
                ...result.metadata, 
                txHash: result.txHash,
                creator: activeAccount,
            },
        });
        setRefreshKey(prevKey => prevKey + 1);
    } catch(error) {
        console.error("Failed to log mint event to journey:", error);
    }
  };

  const handleEvolutionSuccess = async (meebotName: string) => {
    if (!activeAccount) return;
    try {
        await addTimelineEvent({
            type: 'meebot_evolution',
            data: { 
                name: meebotName,
                creator: activeAccount,
            },
        });
        setRefreshKey(prevKey => prevKey + 1);
    } catch(error) {
        console.error("Failed to log evolution event to journey:", error);
    }
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans flex flex-col selection:bg-sky-500/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 w-full">
        <header className="flex items-center justify-between py-4 border-b border-slate-800/50 mb-8">
          <h1 className="text-2xl font-black text-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center shadow-lg shadow-sky-600/20">
                <MeeBotDefaultIcon className="w-8 h-8"/>
            </div>
            <span className="tracking-tight">MEE<span className="text-sky-500">CHAIN</span></span>
          </h1>
        </header>

        <main className="flex-grow space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Wallet Section */}
            <div className="lg:col-span-1">
              <EnhancedWalletUI 
                web3AuthClientId={WEB3AUTH_CLIENT_ID} 
                onMintSuccess={(tx) => setRefreshKey(k => k+1)}
                onAccountChange={(address) => {
                  setActiveAccount(address);
                  setWalletConnected(!!address);
                }}
              />
            </div>

            {/* Dashboard Content */}
            <div className="lg:col-span-2 space-y-8">
                <MeeBotWidget mood="joyful" message="MeeChain Smart Wallet Active. Privacy-preserving AI rendering enabled." />
                
                <section>
                  <h2 className="text-xl font-bold mb-4 text-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                    AI Imaging Studio
                  </h2>
                  <ImageEditor 
                    provider={null} // EnhancedWalletUI manages its own provider
                    connectedAccount={activeAccount} 
                    onConnectWallet={() => {}} // Connection handled by EnhancedWalletUI
                    onMintSuccess={() => setRefreshKey(prev => prev + 1)}
                  />
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="col-span-1 md:col-span-2">
                       <NFTGallery 
                          provider={null} 
                          connectedAccount={activeAccount} 
                          refreshKey={refreshKey} 
                          network={null}
                          onEvolutionSuccess={handleEvolutionSuccess}
                       />
                    </div>
                    <BadgeGallery />
                    <ProposalGrid />
                </div>
                
                <MyJourney connectedAccount={activeAccount} refreshKey={refreshKey} />
            </div>
          </div>
        </main>
      </div>

      <MeeBotStation
        provider={null}
        connectedAccount={activeAccount}
        onConnectWallet={() => {}}
        onMintSuccess={handleMintSuccess}
        onEvolutionSuccess={handleEvolutionSuccess}
        refreshKey={refreshKey}
        network={null}
      />
    </div>
  );
};

export default App;
