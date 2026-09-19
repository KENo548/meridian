/**
 * Auth Adapter - Automatic Driver Selection
 * 
 * Wraps database functions to work with both SQLite (sync) and PostgreSQL (async).
 * Provides a unified API that auth.js can use regardless of the underlying driver.
 */

import * as dbAdapter from './db-adapter.js'

// Wrap sync functions to return promises for consistency
export const createUser = async (...args) => dbAdapter.createUser(...args)
export const getUserById = async (...args) => dbAdapter.getUserById(...args)
export const getUserByUsername = async (...args) => dbAdapter.getUserByUsername(...args)
export const getUserByEmail = async (...args) => dbAdapter.getUserByEmail(...args)
export const updateUserPassword = async (...args) => dbAdapter.updateUserPassword(...args)
export const createPasswordReset = async (...args) => dbAdapter.createPasswordReset(...args)
export const getPasswordReset = async (...args) => dbAdapter.getPasswordReset(...args)
export const usePasswordReset = async (...args) => dbAdapter.usePasswordReset(...args)
export const cleanupExpiredResets = async (...args) => dbAdapter.cleanupExpiredResets(...args)

// Re-export all other functions
export * from './db-adapter.js'
