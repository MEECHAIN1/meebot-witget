import { Buffer } from 'buffer';
import process from 'process';
import EventEmitter from 'events';
import util from 'util';
import crypto from 'crypto-browserify';
import Stream from 'stream-browserify';

// Polyfills for runtime - must happen BEFORE other imports
if (process) {
  if (!process.version) {
    (process as any).version = 'v18.0.0';
  }
  if (!process.versions) {
    (process as any).versions = { node: '18.0.0' };
  }
  if ((process as any).browser === undefined) {
    (process as any).browser = true;
  }
  if (!process.nextTick) {
    (process as any).nextTick = (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0);
  }
  if (!process.env) {
    (process as any).env = {};
  }
}

if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).Buffer = Buffer;
  (window as any).process = process;
  (window as any).EventEmitter = EventEmitter;
  (window as any).util = util;
  (window as any).Stream = Stream;
  
  // Only polyfill crypto if native subtle is missing, or merge them?
  if (!(window as any).crypto) {
    (window as any).crypto = crypto;
  } else {
    const nativeCrypto = (window as any).crypto;
    if (!nativeCrypto.subtle) {
      (window as any).crypto = Object.assign(crypto, nativeCrypto);
    }
  }
  
  if (!(window as any).process.env) {
    (window as any).process.env = {};
  }
  
  if (!(window as any).process.nextTick) {
    (window as any).process.nextTick = (fn: Function, ...args: any[]) => setTimeout(() => fn(...args), 0);
  }
}
