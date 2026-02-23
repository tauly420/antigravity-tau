import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Formula API
export const evaluateFormula = async (data: {
    expression: string;
    is_latex: boolean;
    variables: Record<string, number>;
    uncertainties: Record<string, number>;
}) => {
    const response = await api.post('/formula/evaluate', data);
    return response.data;
};

// N-Sigma API
export const calculateNSigma = async (data: {
    value1: number;
    uncertainty1: number;
    value2: number;
    uncertainty2: number;
}) => {
    const response = await api.post('/nsigma/calculate', data);
    return response.data;
};

// Units API
export const convertUnits = async (data: {
    value: number;
    from_unit: string;
    to_unit: string;
}) => {
    const response = await api.post('/units/convert', data);
    return response.data;
};

export const getUnitCategories = async () => {
    const response = await api.get('/units/categories');
    return response.data;
};

// Matrix API
export const matrixOperations = async (data: {
    operation: string;
    matrix_a: number[][];
    matrix_b?: number[][];
}) => {
    const response = await api.post('/matrix/operations', data);
    return response.data;
};

export const solveSystem = async (data: {
    matrix_a: number[][];
    vector_b: number[];
}) => {
    const response = await api.post('/matrix/solve_system', data);
    return response.data;
};

export const calculateDeterminant = async (data: { matrix: number[][] }) => {
    const response = await api.post('/matrix/determinant', data);
    return response.data;
};

export const luDecomposition = async (data: { matrix: number[][] }) => {
    const response = await api.post('/matrix/lu_decomposition', data);
    return response.data;
};

export const findEigenvalues = async (data: { matrix: number[][] }) => {
    const response = await api.post('/matrix/eigenvalues', data);
    return response.data;
};

// ODE API
export const solveODE = async (data: {
    function: string;
    initial_conditions: number[];
    t_span: [number, number];
    num_points?: number;
    method?: string;
}) => {
    const response = await api.post('/ode/solve', data);
    return response.data;
};

export const getODEMethods = async () => {
    const response = await api.get('/ode/methods');
    return response.data;
};

// Integration API
export const integrate1D = async (data: {
    function: string;
    bounds: [number, number];
    method?: string;
}) => {
    const response = await api.post('/integrate/1d', data);
    return response.data;
};

export const integrateMulti = async (data: {
    function: string;
    bounds: number[][];
    condition?: string;
    num_samples?: number;
}) => {
    const response = await api.post('/integrate/multi', data);
    return response.data;
};

export const getIntegrationMethods = async () => {
    const response = await api.get('/integrate/methods');
    return response.data;
};

// Fitting API — enhanced with sheet/column support
export const parseFileInfo = async (file: File): Promise<{
    sheet_names: string[];
    sheets_info: Record<string, string[]>;
}> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('info_only', 'true');
    const response = await api.post('/fitting/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const parseFileData = async (file: File, sheetName?: string): Promise<{
    columns: string[];
    rows: Record<string, any>[];
    sheet_names: string[];
    row_count: number;
}> => {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) formData.append('sheet_name', sheetName);
    const response = await api.post('/fitting/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// Legacy parse (for standalone GraphFitting)
export const parseFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/fitting/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const fitData = async (data: {
    x_data: number[];
    y_data: number[];
    y_errors?: number[];
    model: string;
    custom_expr?: string;
    initial_guess?: number[];
}) => {
    const response = await api.post('/fitting/fit', data);
    return response.data;
};

// Assistant API
export const chatWithAssistant = async (data: {
    message: string;
    context?: any;
}) => {
    const response = await api.post('/assistant/chat', data);
    return response.data;
};

export const getAssistantStatus = async () => {
    const response = await api.get('/assistant/status');
    return response.data;
};

// Fourier API
export const analyzeFourier = async (data: {
    y_data: number[];
    dt?: number;
    compute_dft?: boolean;
    compute_psd?: boolean;
    n_dominant?: number;
}) => {
    const response = await api.post('/fourier/analyze', data);
    return response.data;
};

export const inverseFourier = async (data: {
    dft_real: number[];
    dft_imag: number[];
    n_points: number;
    filter_type?: string;
    cutoff_low?: number;
    cutoff_high?: number;
    frequencies?: number[];
}) => {
    const response = await api.post('/fourier/inverse', data);
    return response.data;
};
