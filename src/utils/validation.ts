// src/utils/validation.ts
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateAuditRequest = (body: any): { isValid: boolean; error?: string } => {
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

  if (!isValidUrl(url)) {
    return { isValid: false, error: 'Please provide a valid URL starting with http:// or https://' };
  }

  return { isValid: true };
};
