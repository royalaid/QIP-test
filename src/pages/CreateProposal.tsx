import React from 'react'
import { ProposalEditor } from '../components/ProposalEditor'
import { config } from '../config'

const CreateProposal: React.FC = () => {

  return (
    <div className="container mx-auto py-8">
        <ProposalEditor 
          registryAddress={config.qipRegistryAddress}
          rpcUrl={config.baseRpcUrl}
        />
    </div>
  )
}

export default CreateProposal