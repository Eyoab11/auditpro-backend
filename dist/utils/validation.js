"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAuditRequest = exports.isValidUrl = void 0;
// src/utils/validation.ts
const isValidUrl = (url) => {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    }
    catch {
        return false;
    }
};
exports.isValidUrl = isValidUrl;
const validateAuditRequest = (body) => {
    if (!body || typeof body !== 'object') {
        return { isValid: false, error: 'Request body is required' };
    }
    const { url } = body;
    if (!url) {
        return { isValid: false, error: 'URL is required' };
    }
    if (typeof url !== 'string') {
        return { isValid: false, error: 'URL must be a string' };
    }
    if (!(0, exports.isValidUrl)(url)) {
        return { isValid: false, error: 'Please provide a valid URL starting with http:// or https://' };
    }
    return { isValid: true };
};
exports.validateAuditRequest = validateAuditRequest;
//# sourceMappingURL=validation.js.map