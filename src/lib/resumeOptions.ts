/**
 * Which resumes the picker offers, and the limits on attaching a PDF.
 */

import { generalResumes, type Resume } from '../data/resumeStore';

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function prettySize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * The dropdown's options, given the whole list and what is currently selected.
 *
 * Tailored resumes are left out — each was written for one application, and a
 * season of them would bury the handful actually chosen from a list. The
 * current value is always present even when tailored or since deleted, so
 * opening a saved row never silently reassigns its resume.
 */
export function resumeOptions(all: Resume[], selected: string): string[] {
  const labels = generalResumes(all).map((r) => r.label);
  return !selected || labels.includes(selected) ? labels : [selected, ...labels];
}
