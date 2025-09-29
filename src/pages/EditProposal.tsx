import React, { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQCI } from '../hooks/useQCI'
import { ProposalEditor } from '../components/ProposalEditor'
import { config } from '../config/env'

const EditProposal: React.FC = () => {
  const [params] = useSearchParams()
  const qciParam = params.get('qci') || '0'
  const qciNumber = parseInt(qciParam, 10)

  // Use config values
  const registryAddress = config.qciRegistryAddress
  const rpcUrl = config.baseRpcUrl

  const { data: qciData, isLoading, error } = useQCI({
    registryAddress,
    qciNumber,
    rpcUrl,
    enabled: !!registryAddress && qciNumber > 0,
  })

  const existingQCI = useMemo(() => {
    if (!qciData) return undefined
    return {
      qciNumber: BigInt(qciData.qciNumber),
      content: {
        qci: qciData.qciNumber,
        title: qciData.title,
        chain: qciData.chain,
        status: qciData.status,
        author: qciData.author,
        implementor: qciData.implementor,
        'implementation-date': qciData.implementationDate,
        proposal: qciData.proposal,
        created: qciData.created,
        content: qciData.content,
      },
    }
  }, [qciData])

  if (!registryAddress) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded">
            <p className="font-bold">Registry not configured</p>
            <p>Please set VITE_QCI_REGISTRY_ADDRESS and reload.</p>
          </div>
      </div>
    )
  }

  if (qciNumber <= 0) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-500/10 border border-yellow-400 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded">
            <p className="font-bold">Invalid QCI number</p>
            <Link to="/all-proposals" className="mt-2 inline-block text-primary hover:text-primary/80">
              ← Back to all proposals
            </Link>
          </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            <span className="ml-3">Loading proposal...</span>
          </div>
      </div>
    )
  }

  if (error || !existingQCI) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{(error as any)?.message || 'QCI not found'}</p>
            <Link to="/all-proposals" className="mt-2 inline-block text-primary hover:text-primary/80">
              ← Back to all proposals
            </Link>
          </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link to={`/qcis/${qciNumber}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <span>←</span>
            <span>Back to QCI</span>
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-4">Edit QCI</h1>
        <ProposalEditor registryAddress={registryAddress} rpcUrl={rpcUrl} existingQCI={existingQCI} />
      </div>
    </div>
  );
}

export default EditProposal


