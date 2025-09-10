"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preflightUrlReachability = preflightUrlReachability;
const promises_1 = __importDefault(require("dns/promises"));
// Lightweight DNS reachability check to avoid wasting Puppeteer launches on invalid domains
async function preflightUrlReachability(rawUrl, timeoutMs = 5000) {
    let hostname = '';
    try {
        const u = new URL(rawUrl);
        hostname = u.hostname;
    }
    catch {
        return { reachable: false, reason: 'Invalid URL format', hostname: '' };
    }
    try {
        const timer = setTimeout(() => {
            // dns.lookup has no native abort signal; rely on timeout fallthrough
            // We just let it continue; if it later resolves we ignore
        }, timeoutMs).unref?.();
        await promises_1.default.lookup(hostname, { all: false });
        if (timer)
            clearTimeout(timer);
        return { reachable: true, hostname };
    }
    catch (err) {
        if (['ENOTFOUND', 'EAI_AGAIN'].includes(err?.code)) {
            return { reachable: false, reason: `DNS resolution failed (${err.code})`, hostname };
        }
        return { reachable: false, reason: `DNS lookup error: ${err.message || 'unknown error'}`, hostname };
    }
}
//# sourceMappingURL=network.js.map