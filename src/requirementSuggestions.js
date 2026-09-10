const normalizeForComparison = (value) => value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US')

export function suggestionKey(criterionIndex, suggestionIndex) {
  return `${criterionIndex}:${suggestionIndex}`
}

export function getDefaultSuggestionKeys(proposal) {
  const selected = new Set()
  proposal.criteria.forEach((criterion, criterionIndex) => {
    criterion.suggestions.forEach((suggestion, suggestionIndex) => {
      if (suggestion.relationship === 'equivalent' || suggestion.relationship === 'technology') {
        selected.add(suggestionKey(criterionIndex, suggestionIndex))
      }
    })
  })
  return selected
}

export function createStableCriterionId(name, usedIds = []) {
  const base = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'criterion'
  const used = new Set(usedIds)
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

function selectedKeySet(proposal, selectedSuggestionKeys) {
  if (selectedSuggestionKeys === undefined || selectedSuggestionKeys === null) {
    return getDefaultSuggestionKeys(proposal)
  }
  return selectedSuggestionKeys instanceof Set
    ? selectedSuggestionKeys
    : new Set(selectedSuggestionKeys)
}

function selectedAliases(criterion, criterionIndex, selected) {
  return criterion.suggestions
    .filter((_, suggestionIndex) => selected.has(suggestionKey(criterionIndex, suggestionIndex)))
    .map((suggestion) => suggestion.term)
}

function appendUniqueAliases(existing, additions) {
  const result = [...existing]
  const seen = new Set(existing.map(normalizeForComparison))
  additions.forEach((term) => {
    const canonical = normalizeForComparison(term)
    if (!seen.has(canonical)) {
      seen.add(canonical)
      result.push(term.trim().replace(/\s+/g, ' '))
    }
  })
  return result
}

/**
 * Apply a reviewed proposal to an editable requisition without mutating it.
 * Safe relationships are selected by default; callers may pass explicit keys
 * when a recruiter has reviewed contextual (`related`) suggestions too.
 */
export function applyRequirementProposal(draft, proposal, selectedSuggestionKeys) {
  const selected = selectedKeySet(proposal, selectedSuggestionKeys)

  if (proposal.mode === 'enrich') {
    const additionsById = new Map()
    proposal.criteria.forEach((criterion, criterionIndex) => {
      if (!criterion.sourceCriterionId) return
      const additions = selectedAliases(criterion, criterionIndex, selected)
      additionsById.set(
        criterion.sourceCriterionId,
        [...(additionsById.get(criterion.sourceCriterionId) || []), ...additions],
      )
    })
    return {
      ...draft,
      criteria: draft.criteria.map((criterion) => ({
        ...criterion,
        aliases: appendUniqueAliases(criterion.aliases || [], additionsById.get(criterion.id) || []),
      })),
    }
  }

  if (proposal.mode !== 'replace') {
    throw new TypeError(`Unsupported requirement proposal mode: ${proposal.mode}`)
  }

  const usedIds = []
  const criteria = proposal.criteria.map((criterion, criterionIndex) => {
    const id = createStableCriterionId(criterion.id || criterion.name, usedIds)
    usedIds.push(id)
    return {
      id,
      name: criterion.name,
      type: criterion.type,
      description: criterion.description,
      aliases: appendUniqueAliases([], selectedAliases(criterion, criterionIndex, selected)),
    }
  })
  return { ...draft, criteria }
}

