import React, { useState } from 'react'
import { ProposalEditor } from '../components/ProposalEditor'
import { config } from '../config'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { templates, Template } from '../data/templates'

const CreateProposal: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [showTemplates, setShowTemplates] = useState(true)

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
          
          <ProposalEditor 
            registryAddress={config.qipRegistryAddress}
            rpcUrl={config.baseRpcUrl}
            initialTitle={selectedTemplate?.title}
            initialChain={selectedTemplate?.chain}
            initialContent={selectedTemplate?.content}
            initialImplementor={selectedTemplate?.implementor}
          />
        </div>
      )}
    </div>
  )
}

export default CreateProposal