async function fetchCustomJobs(firm) {
  return {
    jobs: [],
    source: 'custom',
    total: 0,
    firm: firm.name,
    error: `Custom adapter not yet implemented for ${firm.name} (${firm.careersProvider})`,
  }
}

export { fetchCustomJobs }
