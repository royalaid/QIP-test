import React, { useState, useMemo } from 'react';
import { type ParsedFunction } from '../utils/abiParser';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Code, Eye, Edit, Database, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FunctionSelectorProps {
  functions: ParsedFunction[];
  selectedFunction: ParsedFunction | null;
  onSelect: (func: ParsedFunction) => void;
}

const STATE_MUTABILITY_CONFIG = {
  view: {
    label: 'Read Only',
    icon: Eye,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-800',
    badge: 'secondary'
  },
  pure: {
    label: 'Pure',
    icon: Code,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    badge: 'secondary'
  },
  nonpayable: {
    label: 'State Changing',
    icon: Edit,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    borderColor: 'border-orange-200 dark:border-orange-800',
    badge: 'default'
  },
  payable: {
    label: 'Payable',
    icon: Database,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    borderColor: 'border-purple-200 dark:border-purple-800',
    badge: 'default'
  }
} as const;

export const FunctionSelector: React.FC<FunctionSelectorProps> = ({
  functions,
  selectedFunction,
  onSelect
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'read' | 'write'>('all');

  // Categorize functions
  const categorizedFunctions = useMemo(() => {
    const readOnly = functions.filter(f => 
      f.stateMutability === 'view' || f.stateMutability === 'pure'
    );
    const stateChanging = functions.filter(f => 
      f.stateMutability === 'nonpayable' || f.stateMutability === 'payable'
    );
    
    return { readOnly, stateChanging, all: functions };
  }, [functions]);

  // Filter functions based on search
  const filteredFunctions = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();
    const filterFn = (f: ParsedFunction) => 
      f.name.toLowerCase().includes(searchLower) ||
      f.inputs.some(i => 
        i.name?.toLowerCase().includes(searchLower) || 
        i.type.toLowerCase().includes(searchLower)
      );

    switch (activeTab) {
      case 'read':
        return categorizedFunctions.readOnly.filter(filterFn);
      case 'write':
        return categorizedFunctions.stateChanging.filter(filterFn);
      default:
        return categorizedFunctions.all.filter(filterFn);
    }
  }, [searchQuery, activeTab, categorizedFunctions]);

  const formatFunctionName = (name: string): string => {
    // Convert camelCase and snake_case to readable format
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatParameterType = (type: string): string => {
    // Simplify common types for display
    const typeMap: Record<string, string> = {
      'uint256': 'Number',
      'uint': 'Number',
      'int256': 'Integer',
      'int': 'Integer',
      'address': 'Address',
      'bool': 'Boolean',
      'string': 'Text',
      'bytes32': 'Bytes32',
      'bytes': 'Bytes'
    };
    
    // Handle arrays
    if (type.includes('[')) {
      const baseType = type.substring(0, type.indexOf('['));
      const simplifiedBase = typeMap[baseType] || baseType;
      return `${simplifiedBase} Array`;
    }
    
    return typeMap[type] || type;
  };

  const renderFunction = (func: ParsedFunction) => {
    const config = STATE_MUTABILITY_CONFIG[func.stateMutability as keyof typeof STATE_MUTABILITY_CONFIG] 
      || STATE_MUTABILITY_CONFIG.nonpayable;
    const Icon = config.icon;
    const isSelected = selectedFunction?.name === func.name;

    return (
      <Card
        key={func.signature}
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-md",
          "border-2",
          isSelected ? [
            "ring-2 ring-primary ring-offset-2",
            "border-primary",
            "bg-primary/5"
          ] : [
            config.borderColor,
            "hover:border-primary/50"
          ]
        )}
        onClick={() => onSelect(func)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", config.color)} />
              <h4 className="font-semibold text-sm">
                {formatFunctionName(func.name)}
              </h4>
            </div>
            <Badge 
              variant={config.badge as any}
              className="text-xs"
            >
              {config.label}
            </Badge>
          </div>

          {/* Original function name if different */}
          {formatFunctionName(func.name) !== func.name && (
            <p className="text-xs text-muted-foreground font-mono mb-2">
              {func.name}()
            </p>
          )}

          {/* Parameters */}
          {func.inputs.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-1">Parameters:</p>
              <div className="space-y-1">
                {func.inputs.map((input, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-xs py-0 h-5">
                      {formatParameterType(input.type)}
                    </Badge>
                    <span className="text-muted-foreground">
                      {input.name || `param${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No parameters required</p>
          )}

          {/* Selection indicator */}
          {isSelected && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-primary font-medium">
                ✓ Selected
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="function-search">Search Functions</Label>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="function-search"
            type="text"
            placeholder="Search by function name or parameter type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">
            All Functions
            <Badge variant="secondary" className="ml-2 h-5 px-1">
              {categorizedFunctions.all.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="read">
            Read Only
            <Badge variant="secondary" className="ml-2 h-5 px-1">
              {categorizedFunctions.readOnly.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="write">
            State Changing
            <Badge variant="secondary" className="ml-2 h-5 px-1">
              {categorizedFunctions.stateChanging.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredFunctions.length > 0 ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {filteredFunctions.map(renderFunction)}
              </div>
            </ScrollArea>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center">
                  {searchQuery 
                    ? `No functions found matching "${searchQuery}"`
                    : 'No functions available in this category'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Quick stats */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Eye className="h-3 w-3" />
          <span>{categorizedFunctions.readOnly.length} read-only</span>
        </div>
        <div className="flex items-center gap-1">
          <Edit className="h-3 w-3" />
          <span>{categorizedFunctions.stateChanging.length} state-changing</span>
        </div>
      </div>
    </div>
  );
};