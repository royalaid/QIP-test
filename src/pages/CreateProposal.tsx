import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ProposalEditor } from '../components/ProposalEditor'
import { config } from '../config'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { templates, Template } from "../data/templates";
import { ImportExportDialog } from "@/components/ImportExportDialog";
import { Upload, FileText, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CreateProposal: React.FC = () => {
  const location = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importedData, setImportedData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have imported data from the dialog
    if (location.state?.importedData) {
      setImportedData(location.state.importedData);
      setShowTemplates(false);
    }
  }, [location.state]);

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplates(false);
  };

  const handleStartFromScratch = () => {
    setSelectedTemplate(null);
    setShowTemplates(false);
  };

  const handleBackToHome = () => {
    navigate("/all-proposals");
  };

  const handleBackToTemplates = () => {
    setShowTemplates(true);
    setSelectedTemplate(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {showTemplates ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={handleBackToHome}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>←</span>
                <span>Back to All Proposals</span>
              </button>
            </div>
            <h1 className="text-4xl font-bold mb-6">Create a New Proposal</h1>
            <h2 className="text-xl font-semibold mb-4">Choose a Template to Get Started</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {templates.map((template) => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle>{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="gradient-primary" className="w-full" onClick={() => handleTemplateSelect(template)}>
                      Use This Template
                    </Button>
                  </CardContent>
                </Card>
              ))}

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle>Start from Scratch</CardTitle>
                  <CardDescription>Create a proposal without a template</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="gradient-muted" className="w-full" onClick={handleStartFromScratch}>
                    Start Fresh
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow border-primary/20">
                <CardHeader>
                  <CardTitle>Import from JSON</CardTitle>
                  <CardDescription>Load a previously exported QCI</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => setShowImportDialog(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Import QCI
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={handleBackToTemplates}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>←</span>
                <span>Back to Templates</span>
              </button>
            </div>
            <h1 className="text-4xl font-bold mb-4">Create a New Proposal</h1>
            {importedData && (
              <Alert className="mb-6 border-blue-400 bg-blue-50 dark:bg-blue-950">
                <AlertDescription className="text-blue-700 dark:text-blue-400">
                  Data imported from JSON export. Review and modify as needed before saving.
                </AlertDescription>
              </Alert>
            )}
            {selectedTemplate && (
              <div className="flex items-center gap-3 mb-6 p-3 bg-muted/50 border border-border rounded-lg">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Using template: <strong className="text-foreground">{selectedTemplate.name}</strong>
                </span>
              </div>
            )}
            <ProposalEditor
              registryAddress={config.qciRegistryAddress}
              rpcUrl={config.baseRpcUrl}
              initialTitle={importedData?.title || selectedTemplate?.title}
              initialChain={importedData?.chain || selectedTemplate?.chain}
              initialContent={importedData?.content || selectedTemplate?.content}
              initialImplementor={importedData?.implementor || selectedTemplate?.implementor}
            />
          </div>
        )}

        <ImportExportDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
      </div>
    </div>
  );
};

export default CreateProposal