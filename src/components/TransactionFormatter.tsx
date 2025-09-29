import React, { useState, useEffect } from 'react';
import { ABIParser, type ParsedFunction, type TransactionData } from '../utils/abiParser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChainCombobox } from './ChainCombobox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Check } from 'lucide-react';
import { FunctionSelector } from './FunctionSelector';

interface TransactionFormatterProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (transaction: TransactionData) => void;
  networks: string[];
  editingTransaction?: TransactionData;
}

export const TransactionFormatter: React.FC<TransactionFormatterProps> = ({
  isOpen,
  onClose,
  onAdd,
  networks,
  editingTransaction
}) => {
  const [chain, setChain] = useState(editingTransaction?.chain || 'Polygon');
  const [contractAddress, setContractAddress] = useState(editingTransaction?.contractAddress || '');
  const [abiInput, setAbiInput] = useState('');
  const [parsedFunctions, setParsedFunctions] = useState<ParsedFunction[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<ParsedFunction | null>(null);
  const [functionArgs, setFunctionArgs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [parseError, setParseError] = useState('');
  const [formattedTransaction, setFormattedTransaction] = useState('');

  // Initialize edit mode
  useEffect(() => {
    if (editingTransaction) {
      setChain(editingTransaction.chain);
      setContractAddress(editingTransaction.contractAddress);
      
      // Set ABI if available
      if (editingTransaction.abi) {
        setAbiInput(JSON.stringify(editingTransaction.abi, null, 2));
        handleParseABI(JSON.stringify(editingTransaction.abi, null, 2));
      }
      
      // Pre-fill function and args
      if (editingTransaction.functionName && editingTransaction.args) {
        const args: Record<string, string> = {};
        editingTransaction.args.forEach((arg, index) => {
          args[`arg_${index}`] = typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        });
        setFunctionArgs(args);
      }
    }
  }, [editingTransaction]);

  // Update formatted transaction preview
  useEffect(() => {
    if (chain && contractAddress && selectedFunction && Object.keys(functionArgs).length === selectedFunction.inputs.length) {
      const args = selectedFunction.inputs.map((_, index) => functionArgs[`arg_${index}`] || '');
      const hasAllArgs = args.every(arg => arg !== '');
      
      if (hasAllArgs) {
        const transaction: TransactionData = {
          chain,
          contractAddress,
          functionName: selectedFunction.name,
          args: args.map((arg, index) => {
            const validation = ABIParser.validateInput(arg, selectedFunction.inputs[index].type);
            return validation.parsed;
          }),
          abi: [] // Will be set when adding
        };
        
        setFormattedTransaction(ABIParser.formatTransaction(transaction));
      } else {
        setFormattedTransaction('');
      }
    } else {
      setFormattedTransaction('');
    }
  }, [chain, contractAddress, selectedFunction, functionArgs]);

  const handleParseABI = (input?: string) => {
    const abiToParse = input || abiInput;
    if (!abiToParse.trim()) {
      setParseError('Please enter an ABI');
      return;
    }

    try {
      const { functions } = ABIParser.parseABI(abiToParse);
      setParsedFunctions(functions);
      setParseError('');
      setSelectedFunction(null);
      setFunctionArgs({});
      setErrors({});
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse ABI');
      setParsedFunctions([]);
    }
  };

  const handleFunctionSelect = (func: ParsedFunction) => {
    setSelectedFunction(func);
    setFunctionArgs({});
    setErrors({});
  };

  const handleArgChange = (index: number, value: string, type: string) => {
    const newArgs = { ...functionArgs, [`arg_${index}`]: value };
    setFunctionArgs(newArgs);

    // Validate input
    if (value) {
      const validation = ABIParser.validateInput(value, type);
      if (!validation.valid) {
        setErrors({ ...errors, [`arg_${index}`]: validation.error || 'Invalid input' });
      } else {
        const newErrors = { ...errors };
        delete newErrors[`arg_${index}`];
        setErrors(newErrors);
      }
    } else {
      const newErrors = { ...errors };
      delete newErrors[`arg_${index}`];
      setErrors(newErrors);
    }
  };

  const handleSubmit = () => {
    if (!chain || !contractAddress || !selectedFunction) {
      return;
    }

    // Validate all inputs
    const args: any[] = [];
    let hasErrors = false;

    selectedFunction.inputs.forEach((input, index) => {
      const value = functionArgs[`arg_${index}`] || '';
      
      if (!value) {
        setErrors(prev => ({ ...prev, [`arg_${index}`]: 'This field is required' }));
        hasErrors = true;
        return;
      }

      const validation = ABIParser.validateInput(value, input.type);
      if (!validation.valid) {
        setErrors(prev => ({ ...prev, [`arg_${index}`]: validation.error || 'Invalid input' }));
        hasErrors = true;
      } else {
        args.push(validation.parsed);
      }
    });

    if (hasErrors) {
      return;
    }

    // Parse ABI for storage
    const { abi } = ABIParser.parseABI(abiInput);

    const transaction: TransactionData = {
      chain,
      contractAddress,
      functionName: selectedFunction.name,
      args,
      abi
    };

    onAdd(transaction);
    handleClose();
  };

  const handleClose = () => {
    setChain('Polygon');
    setContractAddress('');
    setAbiInput('');
    setParsedFunctions([]);
    setSelectedFunction(null);
    setFunctionArgs({});
    setErrors({});
    setParseError('');
    setFormattedTransaction('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
          <DialogDescription>
            Configure an on-chain transaction to be included with this proposal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Chain Selection */}
          <div className="space-y-2">
            <Label htmlFor="chain">Chain</Label>
            <ChainCombobox
              value={chain}
              onChange={setChain}
              placeholder="Select or type a chain..."
              networks={networks}
            />
          </div>

          {/* Contract Address */}
          <div className="space-y-2">
            <Label htmlFor="contractAddress">Contract Address</Label>
            <Input
              id="contractAddress"
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="0x..."
            />
            {contractAddress && !/^0x[a-fA-F0-9]{40}$/.test(contractAddress) && (
              <p className="text-sm text-destructive">Invalid address format</p>
            )}
          </div>

          {/* ABI Input */}
          <div className="space-y-2">
            <Label htmlFor="abi">Contract ABI</Label>
            <Textarea
              id="abi"
              value={abiInput}
              onChange={(e) => setAbiInput(e.target.value)}
              placeholder='Paste contract ABI JSON here, e.g., [{"type":"function","name":"transfer","inputs":[...],"outputs":[...]}]'
              rows={6}
              className="font-mono text-sm"
            />
            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
            <Button
              onClick={() => handleParseABI()}
              variant="secondary"
            >
              Parse ABI
            </Button>
          </div>

          {/* Function Selection */}
          {parsedFunctions.length > 0 && (
            <FunctionSelector
              functions={parsedFunctions}
              selectedFunction={selectedFunction}
              onSelect={handleFunctionSelect}
            />
          )}

          {/* Function Arguments */}
          {selectedFunction && selectedFunction.inputs.length > 0 && (
            <div className="space-y-2">
              <Label>Function Arguments</Label>
              <div className="space-y-3">
                {selectedFunction.inputs.map((input, index) => (
                  <div key={index} className="space-y-2">
                    <Label htmlFor={`arg_${index}`}>
                      {input.name || `Parameter ${index + 1}`} ({input.type})
                    </Label>
                    <Input
                      id={`arg_${index}`}
                      type="text"
                      value={functionArgs[`arg_${index}`] || ''}
                      onChange={(e) => handleArgChange(index, e.target.value, input.type)}
                      placeholder={ABIParser.getTypeDescription(input.type)}
                      className={errors[`arg_${index}`] ? 'border-destructive' : ''}
                    />
                    {errors[`arg_${index}`] && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle size={14} />
                        {errors[`arg_${index}`]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction Preview */}
          {formattedTransaction && (
            <div className="space-y-2">
              <Label>Transaction Preview</Label>
              <div className="rounded-lg bg-muted/30 p-4">
                <code className="break-all font-mono text-sm">{formattedTransaction}</code>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Check size={16} />
                Transaction format valid
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              onClick={handleClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formattedTransaction || Object.keys(errors).length > 0}
              variant="gradient-primary"
            >
              {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};