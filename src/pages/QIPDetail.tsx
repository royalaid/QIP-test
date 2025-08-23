import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { useQIP } from '../hooks/useQIP'
import { useUpdateQIPStatus } from '../hooks/useUpdateQIPStatus'
import Layout from '../layout'
import FrontmatterTable from '../components/FrontmatterTable'
import SnapshotSubmitter from '../components/SnapshotSubmitter'
import { StatusUpdateComponent } from '../components/StatusUpdateComponent'
import { StatusDiscrepancyIndicator } from '../components/StatusDiscrepancyIndicator'
import { ethers } from 'ethers'
import QIPRegistryABI from '../config/abis/QIPRegistry.json'
import { QIPStatus } from '../services/qipClient'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { config } from '../config/env'

const QIPDetail: React.FC = () => {
  const { qipNumber } = useParams<{ qipNumber: string }>()
  const { address } = useAccount()
  const [isClient, setIsClient] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [canSubmitSnapshot, setCanSubmitSnapshot] = useState(false)
  const [isAuthor, setIsAuthor] = useState(false)
  const [isEditor, setIsEditor] = useState(false)
  const { updateStatus } = useUpdateQIPStatus()

  // Extract number from QIP-XXX format
  const qipNumberParsed = qipNumber?.replace('QIP-', '') || '0'

  // Use config values
  const registryAddress = config.qipRegistryAddress
  const rpcUrl = config.baseRpcUrl

  const { data: qipData, isLoading: loading, error, refetch } = useQIP({
    registryAddress,
    qipNumber: parseInt(qipNumberParsed),
    rpcUrl,
    enabled: !!registryAddress && !!qipNumber
  })

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const checkPermissions = async () => {
      if (!address || !qipData) {
        setCanEdit(false)
        setCanSubmitSnapshot(false)
        return
      }

      // Check if user is author
      const authorCheck = qipData.author.toLowerCase() === address.toLowerCase()
      setIsAuthor(authorCheck)
      
      // Check if user has editor or admin role
      let editorCheck = false
      try {
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
        const contract = new ethers.Contract(registryAddress, QIPRegistryABI, provider)
        
        // Check for editor role
        const editorRole = await contract.EDITOR_ROLE()
        const hasEditorRole = await contract.hasRole(editorRole, address)
        
        // Check for admin role (DEFAULT_ADMIN_ROLE is always 0x00 in OpenZeppelin AccessControl)
        // This is the standard admin role that has permission to grant/revoke other roles
        const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000'
        const hasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, address)
        
        editorCheck = hasEditorRole || hasAdminRole
        
        if (editorCheck) {
          console.log(`User ${address} has ${hasAdminRole ? 'admin' : 'editor'} role`)
        }
      } catch (error) {
        console.error('Error checking roles:', error)
      }
      setIsEditor(editorCheck)

      setCanEdit(authorCheck || editorCheck)
      // Editors can submit to snapshot even if they're not the author
      setCanSubmitSnapshot(authorCheck || editorCheck)
    }

    checkPermissions()
  }, [address, qipData, rpcUrl, registryAddress])

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            <span className="ml-3">Loading QIP...</span>
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !qipData) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{error || 'QIP not found'}</p>
            <Link to="/all-proposals" className="mt-2 inline-block text-blue-600 hover:text-blue-800">
              ← Back to all proposals
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const frontmatter = {
    qip: qipData.qipNumber,
    title: qipData.title,
    network: qipData.network,
    status: qipData.status,
    author: qipData.author,
    implementor: qipData.implementor,
    'implementation-date': qipData.implementationDate,
    proposal: qipData.proposal,
    created: qipData.created,
    version: qipData.version
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Link to="/all-proposals" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to all proposals
          </Link>

          <h1 className="text-4xl font-bold mb-4">
            QIP-{qipData.qipNumber}: {qipData.title}
          </h1>

          <div className="mb-6">
            <div className="flex items-center gap-3">
              <StatusUpdateComponent
                qipNumber={BigInt(qipData.qipNumber)}
                currentStatus={qipData.statusEnum || QIPStatus.Draft}
                currentIpfsStatus={qipData.ipfsStatus}
                isAuthor={isAuthor}
                isEditor={isEditor}
                onStatusUpdate={async (newStatus) => {
                  await updateStatus(BigInt(qipData.qipNumber), newStatus)
                  // Refresh the QIP data after update
                  refetch()
                }}
              />
              <StatusDiscrepancyIndicator
                onChainStatus={qipData.status}
                ipfsStatus={qipData.ipfsStatus}
              />
            </div>
          </div>

          <div className="mb-8">
            <FrontmatterTable frontmatter={frontmatter} />
          </div>

          {qipData.ipfsUrl && (
            <div className="mb-4 text-sm text-gray-600">
              <span className="font-semibold">IPFS:</span>{' '}
              <a 
                href={qipData.ipfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                {qipData.ipfsUrl}
              </a>
            </div>
          )}

          <div className="prose prose-lg max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {qipData.content}
            </ReactMarkdown>
          </div>

          {/* Version and edit info */}
          <div className="mt-8 p-4 bg-gray-100 rounded">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Version {qipData.version}
                {qipData.version > 1 && ` • Updated ${qipData.version - 1} time${qipData.version > 2 ? 's' : ''}`}
              </p>
              {canEdit && qipData.status === 'Draft' && (
                <Link 
                  to={`/edit-proposal?qip=${qipData.qipNumber}`}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  Edit Proposal
                </Link>
              )}
            </div>
          </div>

          {/* Snapshot submission for eligible statuses - visible to editors and authors */}
          {/* Also show for recently approved QIPs that don't have a proposal yet */}
          {canSubmitSnapshot && 
           ((qipData.status === 'Review' || qipData.status === 'Vote' || 
            (qipData.status === 'Approved' && (!qipData.proposal || qipData.proposal === 'None'))) && 
            (!qipData.proposal || qipData.proposal === 'None')) && (
            <div className="mt-8 border-t pt-8">
              <h2 className="text-2xl font-bold mb-4">
                Submit to Snapshot
                {config.snapshotSpace !== 'qidao.eth' && (
                  <span className="text-base font-normal text-blue-600 ml-2">
                    (Space: {config.snapshotSpace})
                  </span>
                )}
              </h2>
              {isClient ? (
                <SnapshotSubmitter 
                  frontmatter={frontmatter} 
                  html={`<div>${qipData.content}</div>`}
                  rawMarkdown={qipData.content} 
                />
              ) : (
                <div className="text-center p-4">Loading interactive module...</div>
              )}
            </div>
          )}

          {/* Show existing Snapshot proposal link */}
          {qipData.proposal && qipData.proposal !== 'None' && (
            <div className="mt-8 p-4 bg-blue-50 rounded">
              <h3 className="font-bold mb-2">Snapshot Proposal</h3>
              <a 
                href={qipData.proposal.startsWith('http') ? qipData.proposal : `https://snapshot.org/#/${qipData.proposal}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View on Snapshot →
              </a>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default QIPDetail