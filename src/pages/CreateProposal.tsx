import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ProposalEditor } from '../components/ProposalEditor'
import { config } from '../config'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { templates, Template } from '../data/templates'
import { ImportExportDialog } from '@/components/ImportExportDialog'
import { Upload } from 'lucide-react'

const CreateProposal: React.FC = () => {
  const location = useLocation()
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [showTemplates, setShowTemplates] = useState(true)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importedData, setImportedData] = useState<any>(null)

  useEffect(() => {
    // Check if we have imported data from the dialog
    if (location.state?.importedData) {
      setImportedData(location.state.importedData)
      setShowTemplates(false)
    }
  }, [location.state])

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    setShowTemplates(false)
  }

  const handleStartFromScratch = () => {
    setSelectedTemplate(null)
    setShowTemplates(false)
  }

  const handleBackToTemplates = () => {
    setShowTemplates(true)
    setSelectedTemplate(null)
  }

  return (
    <div className="container mx-auto py-8">
      {showTemplates ? (
        <div>
          <h1 className="text-3xl font-bold mb-6">Create a New Proposal</h1>
          <h2 className="text-xl font-semibold mb-4">Choose a Template to Get Started</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {templates.map((template) => (
              <Card 
                key={template.id} 
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="gradient-primary" 
                    className="w-full"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    Use This Template
                  </Button>
                </CardContent>
              </Card>
            ))}
            
            <Card
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <CardTitle>Start from Scratch</CardTitle>
                <CardDescription>Create a proposal without a template</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="gradient-muted"
                  className="w-full"
                  onClick={handleStartFromScratch}
                >
                  Start Fresh
                </Button>
              </CardContent>
            </Card>

            <Card
              className="hover:shadow-lg transition-shadow border-primary/20"
            >
              <CardHeader>
                <CardTitle>Import from JSON</CardTitle>
                <CardDescription>Load a previously exported QIP</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowImportDialog(true)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import QIP
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div>
          <button 
            onClick={handleBackToTemplates}
            className="mb-4 text-primary hover:text-primary/80"
          >
            ← Back to Templates
          </button>
          
          {selectedTemplate && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-sm">
                Using template: <strong>{selectedTemplate.name}</strong>
              </p>
            </div>
          )}

          {importedData && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm">
                Imported QIP: <strong>{importedData.title || 'Untitled'}</strong>
              </p>
            </div>
          )}
          
          <ProposalEditor
            registryAddress={config.qipRegistryAddress}
            rpcUrl={config.baseRpcUrl}
            initialTitle={importedData?.title || selectedTemplate?.title}
            initialChain={importedData?.chain || selectedTemplate?.chain}
            initialContent={importedData?.content || selectedTemplate?.content}
            initialImplementor={importedData?.implementor || selectedTemplate?.implementor}
          />
        </div>
      )}

      <ImportExportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />
    </div>
  )
}

export default CreateProposal