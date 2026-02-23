import { createContext, useContext, useState, type ReactNode } from 'react';

interface AnalysisContextType {
    currentTool: string;
    setCurrentTool: (tool: string) => void;
    currentData: any;
    setCurrentData: (data: any) => void;
    lastResult: any;
    setLastResult: (result: any) => void;
    analysisHistory: string[];
    addToHistory: (entry: string) => void;
    uploadedFileInfo: string;
    setUploadedFileInfo: (info: string) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider = ({ children }: { children: ReactNode }) => {
    const [currentTool, setCurrentTool] = useState<string>('Home');
    const [currentData, setCurrentData] = useState<any>(null);
    const [lastResult, setLastResult] = useState<any>(null);
    const [analysisHistory, setAnalysisHistory] = useState<string[]>([]);
    const [uploadedFileInfo, setUploadedFileInfo] = useState<string>('');

    const addToHistory = (entry: string) => {
        setAnalysisHistory(prev => [...prev.slice(-19), entry]);
    };

    return (
        <AnalysisContext.Provider value={{
            currentTool, setCurrentTool,
            currentData, setCurrentData,
            lastResult, setLastResult,
            analysisHistory, addToHistory,
            uploadedFileInfo, setUploadedFileInfo,
        }}>
            {children}
        </AnalysisContext.Provider>
    );
};

export const useAnalysis = () => {
    const context = useContext(AnalysisContext);
    if (!context) throw new Error('useAnalysis must be used inside AnalysisProvider');
    return context;
};
