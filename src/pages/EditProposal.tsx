import React, { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQIP } from '../hooks/useQIP'
import { ProposalEditor } from '../components/ProposalEditor'
import { config } from '../config/env'

const EditProposal: React.FC = () => {
  const [params] = useSearchParams()
  const qipParam = params.get('qip') || '0'
  const qipNumber = parseInt(qipParam, 10)

  // Use config values
  const registryAddress = config.qipRegistryAddress
  const rpcUrl = config.baseRpcUrl

  const { data: qipData, isLoading, error } = useQIP({
    registryAddress,
    qipNumber,
    rpcUrl,
    enabled: !!registryAddress && qipNumber > 0,
  })

  const existingQIP = useMemo(() => {
    if (!qipData) return undefined
    return {
      qipNumber: BigInt(qipData.qipNumber),
      content: {
        qip: qipData.qipNumber,
        title: qipData.title,
        chain: qipData.chain,
        status: qipData.status,
        author: qipData.author,
        implementor: qipData.implementor,
        'implementation-date': qipData.implementationDate,
        proposal: qipData.proposal,
        created: qipData.created,
        content: qipData.content,
      },
    }
  }, [qipData])

  if (!registryAddress) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded">
            <p className="font-bold">Registry not configured</p>
            <p>Please set VITE_QIP_REGISTRY_ADDRESS and reload.</p>
          </div>
      </div>
    )
  }

  if (qipNumber <= 0) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-500/10 border border-yellow-400 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded">
            <p className="font-bold">Invalid QIP number</p>
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

  if (error || !existingQIP) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="bg-destructive/10 border border-red-400 text-destructive px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{(error as any)?.message || 'QIP not found'}</p>
            <Link to="/all-proposals" className="mt-2 inline-block text-primary hover:text-primary/80">
              ← Back to all proposals
            </Link>
          </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
        <div className="mb-6">
          <Link to={`/qips/${qipNumber}`} className="text-primary hover:text-primary/80">
            ← Back to QIP-{qipNumber}
          </Link>
        </div>
        <h1 className="text-3xl font-bold mb-6">Edit QIP-{qipNumber}</h1>
        <ProposalEditor
          registryAddress={registryAddress}
          rpcUrl={rpcUrl}
          existingQIP={existingQIP}
        />
    </div>
  )
}

export default EditProposal


