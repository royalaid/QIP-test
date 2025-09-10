import React, { useState, useEffect } from 'react';
import { ABIParser, type ParsedFunction, type TransactionData } from '../utils/abiParser';
import { GradientButton } from './gradient-button';
import { X, AlertCircle, Check } from 'lucide-react';

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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-background p-6 shadow-xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted/50"
        >
          <X size={20} />
        </button>

        <h2 className="mb-6 text-2xl font-bold">
          {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
        </h2>

        <div className="space-y-6">
          {/* Chain Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Chain
            </label>
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="w-full rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 p-2"
            >
              {networks.map(network => (
                <option key={network} value={network}>{network}</option>
              ))}
            </select>
          </div>

          {/* Contract Address */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Contract Address
            </label>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 p-2"
            />
            {contractAddress && !/^0x[a-fA-F0-9]{40}$/.test(contractAddress) && (
              <p className="mt-1 text-sm text-destructive">Invalid address format</p>
            )}
          </div>

          {/* ABI Input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Contract ABI
            </label>
            <textarea
              value={abiInput}
              onChange={(e) => setAbiInput(e.target.value)}
              placeholder='Paste contract ABI JSON here, e.g., [{"type":"function","name":"transfer","inputs":[...],"outputs":[...]}]'
              rows={6}
              className="w-full rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary font-mono text-sm dark:bg-zinc-800 dark:border-zinc-700 p-2"
            />
            {parseError && (
              <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                <AlertCircle size={14} />
                {parseError}
              </p>
            )}
            <button
              onClick={() => handleParseABI()}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
            >
              Parse ABI
            </button>
          </div>

          {/* Function Selection */}
          {parsedFunctions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Select Function
              </label>
              <div className="space-y-2">
                {parsedFunctions.map((func, index) => (
                  <button
                    key={index}
                    onClick={() => handleFunctionSelect(func)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedFunction?.name === func.name
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="font-mono text-sm font-semibold">{func.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {func.inputs.length === 0
                        ? 'No parameters'
                        : `Parameters: ${func.inputs.map(i => `${i.name || 'param'}: ${i.type}`).join(', ')}`}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      State: {func.stateMutability}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Function Arguments */}
          {selectedFunction && selectedFunction.inputs.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Function Arguments
              </label>
              <div className="space-y-3">
                {selectedFunction.inputs.map((input, index) => (
                  <div key={index}>
                    <label className="block text-sm text-muted-foreground mb-1">
                      {input.name || `Parameter ${index + 1}`} ({input.type})
                    </label>
                    <input
                      type="text"
                      value={functionArgs[`arg_${index}`] || ''}
                      onChange={(e) => handleArgChange(index, e.target.value, input.type)}
                      placeholder={ABIParser.getTypeDescription(input.type)}
                      className={`w-full rounded-md border ${
                        errors[`arg_${index}`] ? 'border-destructive' : 'border-border'
                      } bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary dark:bg-zinc-800 dark:border-zinc-700 p-2`}
                    />
                    {errors[`arg_${index}`] && (
                      <p className="mt-1 text-sm text-destructive flex items-center gap-1">
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
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Transaction Preview
              </label>
              <div className="rounded-lg bg-muted/30 p-4">
                <code className="break-all font-mono text-sm">{formattedTransaction}</code>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <Check size={16} />
                Transaction format valid
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <button
              onClick={handleClose}
              className="rounded-lg border border-border bg-card px-6 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/50"
            >
              Cancel
            </button>
            <GradientButton
              onClick={handleSubmit}
              disabled={!formattedTransaction || Object.keys(errors).length > 0}
              variant="primary"
              className="text-sm"
            >
              {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
            </GradientButton>
          </div>
        </div>
      </div>
    </div>
  );
};