// Switch TypeScript Definitions
// Based on Enfocus Switch Scripting API

declare enum LogLevel {
    Info = 1,
    Warning = 2,
    Error = 3,
    Debug = 4
}

declare enum PropertyType {
    literal = "literal",
    number = "number",
    date = "date",
    boolean = "boolean"
}

declare namespace Connection {
    enum Level {
        Success = -1,
        Error = -2
    }
}

declare class Switch {
    getPropertyValue(name: string): string | null;
    getServerName(): string;
    getFlowName(): string;
    getElementName(): string;
    getFlowId(): string;
    getOutgoingConnectionCount?(): number;
    getOutgoingName?(index: number): string | null;
    sendEmail(to: string, subject: string, body: string): void;
    log(level: LogLevel, message: string): void;
}

declare class Job {
    getPath(): string;
    getName(): string;
    getJobNumber(): string;
    getPriority(): string;
    getPrivateData(key: string): string | null;
    setPrivateData(key: string, value: string): void;
    getPrivateDataKeys(): string[];
    sendToData(connection: number): void;
    log(level: LogLevel, message: string): void;
    fail(message: string): void;
    readEntireFile(): string;
}

declare class HTTP {
    get(url: string, callback: (response: HTTPResponse) => void): void;
    post(url: string, data: SwitchFormData, callback: (response: HTTPResponse) => void): void;
}

declare class HTTPResponse {
    statusCode: number;
    body: string;
}

declare class SwitchFormData {
    addField(name: string, value: string): void;
    addFile(name: string, path: string): void;
}

// Override global FormData for Switch environment
declare var FormData: {
    new(): SwitchFormData;
};

// Global functions that exist in Switch environment
// Note: jobArrived is implemented in each script file