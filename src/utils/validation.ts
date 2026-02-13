import type { UserProfile } from '../types.js';

export function validateProfile(profile: UserProfile): void {
  const requiredFields: (keyof UserProfile)[] = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'location',
    'school',
    'education',
    'experienceLevel',
    'skills',
    'coverLetter',
    'earliestStartDate',
    'referralSource'
  ];

  const missingFields: string[] = [];
  const emptyFields: string[] = [];

  for (const field of requiredFields) {
    const value = profile[field];
    
    if (value === undefined || value === null) {
      missingFields.push(field);
    } else if (typeof value === 'string' && value.trim() === '') {
      emptyFields.push(field);
    } else if (Array.isArray(value) && value.length === 0) {
      emptyFields.push(field);
    }
  }

  if (missingFields.length > 0 || emptyFields.length > 0) {
    const errors: string[] = [];
    
    if (missingFields.length > 0) {
      errors.push(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    if (emptyFields.length > 0) {
      errors.push(`Empty required fields: ${emptyFields.join(', ')}`);
    }
    
    throw new Error(`Profile validation failed:\n  ${errors.join('\n  ')}`);
  }
}
