#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type Config } from './config.js';
import { type Backend } from './adapters/upstream.js';
import { Http } from './utils/http.js';
import { Library } from './storage/library.js';
import { SearchService } from './search/service.js';
import { DownloadService } from './download/service.js';
export declare function createApp(cfg?: Config, dependencies?: {
    backend?: Backend;
    http?: Http;
}): Promise<{
    server: McpServer;
    search: SearchService;
    download: DownloadService;
    library: Library;
    close(): Promise<void>;
}>;
