import { Env, CacheParams, MIMEPair } from './types';

export interface HandlerInterface {
    getCacheParams(): CacheParams;
    handle(fetcherRequest: Request, fetcherResponse: Response): Promise<Uint8Array>;
    getMIME(): MIMEPair;
}