import React from 'react';
import { config } from '../config/env';

const Debug = () => {
  const envVars = {
    'VITE_QCI_REGISTRY_ADDRESS': import.meta.env.VITE_QCI_REGISTRY_ADDRESS,
    'VITE_BASE_RPC_URL': import.meta.env.VITE_BASE_RPC_URL,
    'VITE_USE_LOCAL_IPFS': import.meta.env.VITE_USE_LOCAL_IPFS,
    'VITE_USE_MAI_API': import.meta.env.VITE_USE_MAI_API,
    'VITE_LOCAL_MODE': import.meta.env.VITE_LOCAL_MODE,
    'config.qciRegistryAddress': config.qciRegistryAddress,
    'config.baseRpcUrl': config.baseRpcUrl,
    'config.useLocalIPFS': config.useLocalIPFS,
    'config.useMaiApi': config.useMaiApi,
    'config.localMode': config.localMode,
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Debug Environment Variables</h1>
      <div className="bg-gray-100 p-4 rounded">
        <pre>{JSON.stringify(envVars, null, 2)}</pre>
      </div>
      <div className="mt-4">
        <h2 className="text-xl font-bold mb-2">Query Key for QCIs List:</h2>
        <code className="bg-gray-200 p-2 rounded">
          ['qcis', 'list', '{config.qciRegistryAddress || "undefined"}', filters]
        </code>
      </div>
    </div>
  );
};

export default Debug;