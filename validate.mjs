#!/usr/bin/env node
/**
 * Validate the JASP Quality Guide's reachable decisions, teaching cases, and
 * content/data contracts. Node standard library only; no network or browser.
 *
 * Run: node validate.mjs
 * The graph is enumerated independently of walk(), including every distinct
 * history leading to a context-dependent next function. Named methodological
 * expectations then protect against semantically wrong but structurally valid
 * routes. Deliberate g: review/prerequisite outcomes are valid terminals.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const failures = [];
let checks = 0;
function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
  return Boolean(condition);
}
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const array = value => Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const load = filename => JSON.parse(fs.readFileSync(path.join(directory, filename), 'utf8'));

const contentFiles = ['qc-content.json', 'method-content.json', 'correlation-content.json',
  'survival-content.json', 'acceptance-content.json', 'classical-content.json'];
const exampleFiles = ['examples.json', 'correlation-examples.json', 'survival-examples.json',
  'acceptance-examples.json', 'classical-examples.json'];
function mergeCollections(filenames, kind) {
  const merged = {};
  for (const filename of filenames) {
    const collection = load(filename);
    check(collection && typeof collection === 'object' && !array(collection), `${filename}: expected an object keyed by ${kind} id.`);
    for (const [id, record] of Object.entries(collection || {})) {
      check(!own(merged, id), `Duplicate ${kind} id in ${filename}: ${id}.`);
      merged[id] = record;
    }
  }
  return merged;
}

let flow, analyses, examples;
try {
  analyses = mergeCollections(contentFiles, 'analysis');
  examples = mergeCollections(exampleFiles, 'dataset');
  const sandbox = vm.createContext(Object.create(null));
  for (const filename of ['flow.js', 'extensions-flow.js']) {
    const source = fs.readFileSync(path.join(directory, filename), 'utf8');
    new vm.Script(source, {filename}).runInContext(sandbox, {timeout: 1000});
  }
  new vm.Script(';globalThis.__validation = {GOALS,NODES,GUARDS,REFERENCES,SCENARIOS,walk};',
    {filename: 'validation-export.js'}).runInContext(sandbox, {timeout: 1000});
  flow = sandbox.__validation;
} catch (error) {
  console.error(`FAIL: Could not load guide source: ${error.message}`);
  process.exit(1);
}

const {GOALS, NODES, GUARDS, REFERENCES, SCENARIOS, walk} = flow;
check(Object.keys(GOALS).length === 8, 'Expected the eight declared practitioner goals.');

function validTerminal(current, context) {
  if (!check(nonempty(current), `${context}: transition must return a nonempty string.`)) return false;
  if (current.startsWith('r:')) {
    return check(own(analyses, current.slice(2)), `${context}: missing recommendation ${current}.`);
  }
  if (current.startsWith('g:')) {
    return check(own(GUARDS, current.slice(2)), `${context}: missing review/prerequisite outcome ${current}.`);
  }
  return check(own(NODES, current), `${context}: missing question ${current}.`);
}

// Validate question contracts before traversal, including unused questions.
for (const [id, node] of Object.entries(NODES)) {
  for (const field of ['title', 'description', 'short']) {
    check(nonempty(node[field]), `Question ${id}: missing ${field}.`);
  }
  check(array(node.help) && node.help.length > 0 && node.help.every(nonempty),
    `Question ${id}: needs readable explanatory help.`);
  if (!check(array(node.options) && node.options.length > 0, `Question ${id}: no answer choices.`)) continue;
  const values = new Set();
  for (const option of node.options) {
    check(nonempty(option.value) && !values.has(option.value), `Question ${id}: duplicate/empty choice ${option.value}.`);
    values.add(option.value);
    check(nonempty(option.label) && nonempty(option.description), `Question ${id}/${option.value}: unlabeled choice.`);
    check(typeof option.next === 'function' || nonempty(option.next),
      `Question ${id}/${option.value}: missing next transition.`);
    if (typeof option.next === 'string') validTerminal(option.next, `Question ${id}/${option.value}`);
  }
}

// Exhaustively traverse every choice path. The ancestor set is path-specific:
// converging routes are allowed, but revisiting a question on one route is not.
const paths = [];
const reachableNodes = new Set();
const reachableAnalyses = new Set();
const reachableGuards = new Set();
const goalCounts = {};
const traversedChoices = new Set();
function enumerate(goal, current, history, ancestors) {
  const context = `${goal}: ${history.map(item => `${item.id}=${item.value}`).join(' → ') || '(start)'}`;
  if (!validTerminal(current, context)) return;
  if (current.startsWith('r:') || current.startsWith('g:')) {
    paths.push({goal, current, history});
    goalCounts[goal] = (goalCounts[goal] || 0) + 1;
    (current.startsWith('r:') ? reachableAnalyses : reachableGuards).add(current.slice(2));
    return;
  }
  if (!check(!ancestors.has(current), `${context}: cycle revisits ${current}.`)) return;
  if (!check(history.length < 40, `${context}: exceeds a safe decision depth.`)) return;
  reachableNodes.add(current);
  const nextAncestors = new Set(ancestors).add(current);
  const node = NODES[current];
  if (!array(node.options)) return;
  for (const option of node.options) {
    traversedChoices.add(`${current}:${option.value}`);
    const nextHistory = [...history, {id: current, value: option.value, label: option.label, short: node.short}];
    try {
      const next = typeof option.next === 'function' ? option.next(nextHistory) : option.next;
      enumerate(goal, next, nextHistory, nextAncestors);
    } catch (error) {
      failures.push(`${context}/${option.value}: transition threw ${error.message}.`);
    }
  }
}
for (const [goal, metadata] of Object.entries(GOALS)) {
  check(nonempty(metadata.title) && nonempty(metadata.description), `Goal ${goal}: missing visible content.`);
  check(own(NODES, metadata.start), `Goal ${goal}: missing starting question ${metadata.start}.`);
  enumerate(goal, metadata.start, [], new Set());
}
for (const id of Object.keys(NODES)) check(reachableNodes.has(id), `Question ${id} is unreachable from all goals.`);
for (const id of Object.keys(analyses)) check(reachableAnalyses.has(id), `Analysis ${id} is never recommended by a goal route.`);
for (const id of Object.keys(GUARDS)) check(reachableGuards.has(id), `Review/prerequisite outcome ${id} is unreachable.`);

// Cross-check the real navigation helper against the independent enumeration.
for (const route of paths) {
  const picks = route.history.map(answer => answer.value);
  const actual = walk(route.goal, picks);
  const label = `${route.goal} [${picks.join(', ')}]`;
  check(actual && actual.current === route.current, `walk() disagrees with full traversal for ${label}.`);
  check(actual && actual.history.length === picks.length, `walk() did not consume all valid answers for ${label}.`);
  check(actual && actual.history.every((answer, index) =>
    answer.id === route.history[index].id && answer.value === route.history[index].value),
    `walk() lost or reordered decision history for ${label}.`);
}

// Semantic expectations are derived from the QC questions, not from graph edges.
// They catch plausible-looking bad recommendations such as u for failed units,
// independent tests for paired data, or capability before stability is examined.
const cases = [
  ['Individual values need I–MR', 'monitor', ['continuous', 'ordered', 'individual', 'general'], 'r:imr'],
  ['Small sustained changes can use EWMA', 'monitor', ['continuous', 'ordered', 'individual', 'smooth'], 'r:ewma'],
  ['Reference deviations can use CUSUM', 'monitor', ['continuous', 'ordered', 'individual', 'cumulative'], 'r:cusum'],
  ['Small rational subgroups use Xbar–R', 'monitor', ['continuous', 'ordered', 'subgroups', 'small'], 'r:xbar_r'],
  ['Larger rational subgroups use Xbar–S', 'monitor', ['continuous', 'ordered', 'subgroups', 'large'], 'r:xbar_s'],
  ['Unequal subgroups require review', 'monitor', ['continuous', 'ordered', 'subgroups', 'unequal'], 'g:subgroups'],
  ['Repeated readings of one part are not production subgroups', 'monitor', ['continuous', 'ordered', 'samepart'], 'g:repeated_item'],
  ['Fixed-n failed units use np', 'monitor', ['passfail', 'ordered', 'constant'], 'r:np_chart'],
  ['Varying-n failed units use p', 'monitor', ['passfail', 'ordered', 'varying'], 'r:p_chart'],
  ['Fixed-exposure defects use c', 'monitor', ['defects', 'ordered', 'constant'], 'r:c_chart'],
  ['Varying-exposure defects use u', 'monitor', ['defects', 'ordered', 'varying'], 'r:u_chart'],
  ['Percentages require denominators', 'monitor', ['passfail', 'ordered', 'missing'], 'g:denominator'],
  ['Defect counts require exposure', 'monitor', ['defects', 'ordered', 'missing'], 'g:denominator'],
  ['Missing time order prevents SPC routing', 'monitor', ['continuous', 'unknown'], 'g:order'],
  ['Strong dependence prevents ordinary SPC routing', 'monitor', ['continuous', 'dependent'], 'g:monitor_dependence'],
  ['Ordered counts can still have dependence', 'monitor', ['passfail', 'dependent'], 'g:monitor_dependence'],
  ['Stable continuous normal process can use normal capability', 'capability', ['continuous', 'two', 'checked', 'normal'], 'r:cap_normal'],
  ['A genuine one-sided spec is sufficient', 'capability', ['continuous', 'one', 'checked', 'normal'], 'r:cap_normal'],
  ['Skewed process should not silently get normal capability', 'capability', ['continuous', 'one', 'checked', 'skew'], 'r:cap_nonnormal'],
  ['Unexamined stability needs a preliminary step', 'capability', ['continuous', 'two', 'unchecked'], 'g:stability'],
  ['Unstable process needs investigation', 'capability', ['continuous', 'two', 'unstable'], 'g:stability'],
  ['Target alone does not define capability specs', 'capability', ['continuous', 'target'], 'g:specifications'],
  ['Attribute capability must not use normal Cp/Cpk', 'capability', ['attribute'], 'g:attribute_capability'],
  ['Unknown distribution needs assessment', 'capability', ['continuous', 'two', 'checked', 'unsure'], 'g:distribution'],
  ['Categorical measurements need agreement analysis', 'measurement', ['categorical'], 'r:attribute_agreement'],
  ['One reference uses Type 1', 'measurement', ['continuous', 'one'], 'r:gage_type1'],
  ['Several references across range use linearity', 'measurement', ['continuous', 'linearity'], 'r:gage_linearity'],
  ['Shared parts and repeats use crossed R&R', 'measurement', ['continuous', 'rr', 'crossed', 'yes'], 'r:gage_crossed'],
  ['Unique part sets and repeats use nested R&R', 'measurement', ['continuous', 'rr', 'nested', 'yes'], 'r:gage_nested'],
  ['Crossed R&R without repeats needs review', 'measurement', ['continuous', 'rr', 'crossed', 'no'], 'g:replication'],
  ['Nested R&R without interpretable repeats needs review', 'measurement', ['continuous', 'rr', 'nested', 'no'], 'g:replication'],
  ['Destructive unique batches can be nested', 'measurement', ['continuous', 'rr', 'destructive', 'nested', 'yes'], 'r:gage_nested'],
  ['Destructive shared batches are not automatically nested', 'measurement', ['continuous', 'rr', 'destructive', 'crossed'], 'g:destructive_crossed'],
  ['Unknown specimen equivalence requires review', 'measurement', ['continuous', 'rr', 'destructive', 'unknown'], 'g:replication'],
  ['One mean against reference uses one-sample test', 'compare', ['continuous', 'difference', 'one'], 'r:one_t'],
  ['Independent means use independent test', 'compare', ['continuous', 'difference', 'ind'], 'r:ind_t'],
  ['Paired means preserve pairing', 'compare', ['continuous', 'difference', 'paired'], 'r:paired_t'],
  ['One mean close enough needs equivalence', 'compare', ['continuous', 'equivalent', 'one'], 'r:eq_one'],
  ['Independent close-enough claim needs equivalence', 'compare', ['continuous', 'equivalent', 'ind'], 'r:eq_ind'],
  ['Paired close-enough claim needs paired equivalence', 'compare', ['continuous', 'equivalent', 'paired'], 'r:eq_paired'],
  ['Several independent groups use ANOVA', 'compare', ['continuous', 'difference', 'many', 'ind'], 'r:one_anova'],
  ['Several repeated conditions preserve repetition', 'compare', ['continuous', 'difference', 'many', 'repeated'], 'r:rm_anova'],
  ['Incomplete repeated design needs a specific model', 'compare', ['continuous', 'difference', 'many', 'complex'], 'g:dependence'],
  ['Multi-group equivalence needs an explicit joint claim', 'compare', ['continuous', 'equivalent', 'many'], 'g:multiple_equivalence'],
  ['Additional clustering blocks a simple independent test', 'compare', ['continuous', 'difference', 'complex'], 'g:dependence'],
  ['One independent failure proportion uses binomial', 'compare', ['binary', 'one'], 'r:binomial'],
  ['Two independent proportions use the dedicated classical test', 'compare', ['binary', 'groups', 'two'], 'r:proportion_two'],
  ['More than two independent proportions use a joint classical test', 'compare', ['binary', 'groups', 'many'], 'r:proportion_multiple'],
  ['Paired binary outcomes must not use independent table test', 'compare', ['binary', 'paired'], 'g:paired_binary'],
  ['Clustered binary outcomes need review', 'compare', ['binary', 'clustered'], 'g:dependence'],
  ['Independent unordered categories use contingency table', 'compare', ['categories', 'ind'], 'r:contingency'],
  ['Repeated categories must preserve dependence', 'compare', ['categories', 'paired'], 'g:paired_binary'],
  ['Ordered ratings are not silently mean tests', 'compare', ['other'], 'g:other_outcome'],
  ['Feasible screening can use factorial design', 'doe', ['plan', 'screen', 'feasible'], 'r:doe_factorial'],
  ['Restricted screening design needs review', 'doe', ['plan', 'screen', 'restricted'], 'g:restricted_doe'],
  ['Continuous feasible optimization can use response surface', 'doe', ['plan', 'optimise', 'continuous'], 'r:doe_surface'],
  ['Constrained or categorical response surface needs review', 'doe', ['plan', 'optimise', 'restricted'], 'g:restricted_doe'],
  ['Confirmation uses new runs', 'doe', ['plan', 'confirm'], 'g:confirmation'],
  ['Existing designed runs go to design analysis', 'doe', ['analyse', 'designed'], 'r:doe_analyze'],
  ['Routine records do not become randomized experiments', 'doe', ['analyse', 'observational'], 'g:observational_doe'],
  ['Missing design information must be recovered', 'doe', ['analyse', 'unknown'], 'g:design_information'],
  ['Continuous independent response can use linear regression', 'model', ['continuous', 'ind', 'association'], 'r:linear_regression'],
  ['Continuous prediction still uses appropriate linear model', 'model', ['continuous', 'ind', 'prediction'], 'r:linear_regression'],
  ['Binary independent response needs logistic model', 'model', ['binary', 'ind', 'association'], 'r:logistic_regression'],
  ['Binary prediction must remain a probability model', 'model', ['binary', 'ind', 'prediction'], 'r:logistic_regression'],
  ['Counts with predictors still require count-model settings', 'model', ['count', 'model'], 'g:count_model'],
  ['Censored records can reach the dedicated survival curve', 'model', ['censored', 'first', 'right', 'curve'], 'r:survival_km'],
  ['Other specialised response models still require review', 'model', ['other'], 'g:special_model'],
  ['Clustered continuous records need specific structure', 'model', ['continuous', 'clustered'], 'g:dependence'],
  ['Clustered binary records need specific structure', 'model', ['binary', 'clustered'], 'g:dependence'],
  ['Serial dependence must be represented', 'model', ['continuous', 'time'], 'g:regression_dependence'],
  ['Binary serial dependence must be represented', 'model', ['binary', 'time'], 'g:regression_dependence'],
  ['Association alone does not establish intervention effect', 'model', ['continuous', 'ind', 'causal'], 'g:causality'],
  ['Binary association alone does not establish intervention effect', 'model', ['binary', 'ind', 'causal'], 'g:causality'],

  // Relationship questions: preserve sampling units, scale, and estimand.
  ['Independent linear association can use Pearson correlation', 'model', ['correlation', 'ind', 'unadjusted', 'linear'], 'r:correlation_pearson'],
  ['Ordinal or monotonic association can use rank correlation', 'model', ['correlation', 'ind', 'unadjusted', 'rank'], 'r:correlation_rank'],
  ['A justified continuous linear adjustment can use partial correlation', 'model', ['correlation', 'ind', 'partial', 'linear'], 'r:correlation_partial'],
  ['Repeated pairs must not become independent correlations', 'model', ['correlation', 'repeated'], 'g:dependence'],
  ['Serially dependent pairs require a time-aware model', 'model', ['correlation', 'time'], 'g:regression_dependence'],
  ['Agreement questions must not be answered by a correlation', 'model', ['correlation', 'agreement'], 'g:correlation_agreement'],
  ['U-shaped or mixed patterns need inspection before one coefficient', 'model', ['correlation', 'ind', 'unadjusted', 'curved'], 'g:correlation_shape'],
  ['Factors and nonlinear adjustments need an explicit model', 'model', ['correlation', 'ind', 'partial', 'complex'], 'g:correlation_adjustment'],

  // Classical Tests: mean tests, variance tests, rates and proportions differ.
  ['One independent normal variance can be tested against a reference', 'compare', ['continuous', 'variation', 'one', 'plausible'], 'r:variance_one'],
  ['An unassessed one-variance model must not silently use chi-square inference', 'compare', ['continuous', 'variation', 'one', 'uncertain'], 'g:variance_assumptions'],
  ['Two raw independent groups can use robust spread comparison', 'compare', ['continuous', 'variation', 'two', 'raw'], 'r:variance_two'],
  ['More than two raw independent groups need a joint spread comparison', 'compare', ['continuous', 'variation', 'many', 'raw'], 'r:variance_multiple'],
  ['Two normal-group summaries can use the supplied variance analysis', 'compare', ['continuous', 'variation', 'two', 'summary'], 'r:variance_two'],
  ['Several normal-group summaries can use the supplied variance analysis', 'compare', ['continuous', 'variation', 'many', 'summary'], 'r:variance_multiple'],
  ['Paired variance observations must not be treated as independent groups', 'compare', ['continuous', 'variation', 'two', 'dependent'], 'g:dependence'],
  ['Clustered multigroup spread requires the dependence structure', 'compare', ['continuous', 'variation', 'many', 'dependent'], 'g:dependence'],
  ['Summary data cannot establish a robust two-group spread test', 'compare', ['continuous', 'variation', 'two', 'uncertain'], 'g:variance_assumptions'],
  ['Summary data cannot establish a robust multigroup spread test', 'compare', ['continuous', 'variation', 'many', 'uncertain'], 'g:variance_assumptions'],
  ['Variance components require a measurement-system study', 'compare', ['continuous', 'variation', 'components'], 'g:variance_components'],
  ['One count with matching exposure can test a reference rate', 'compare', ['count', 'one', 'ready'], 'r:poisson_one'],
  ['Two independent counts with exposure can compare rates', 'compare', ['count', 'two', 'ready'], 'r:poisson_two'],
  ['Reference rate needs its exposure denominator', 'compare', ['count', 'one', 'missing'], 'g:rate_exposure'],
  ['Rate comparison needs matching exposure in both populations', 'compare', ['count', 'two', 'missing'], 'g:rate_exposure'],
  ['Overdispersed one-rate observations need a different model', 'compare', ['count', 'one', 'violated'], 'g:rate_model'],
  ['Clustered event populations cannot use the simple two-rate test automatically', 'compare', ['count', 'two', 'violated'], 'g:rate_model'],
  ['Several rates or covariates require a specified count model', 'compare', ['count', 'model'], 'g:count_model'],
  ['The relationships entry also reaches One Rate with exposure', 'model', ['count', 'one', 'ready'], 'r:poisson_one'],
  ['The relationships entry also reaches Two Rates with exposure', 'model', ['count', 'two', 'ready'], 'r:poisson_two'],
  ['The count entry cannot bypass an absent denominator', 'model', ['count', 'two', 'missing'], 'g:rate_exposure'],

  // Lifetime records: preserve censoring, repeated events, and available tools.
  ['Independent first-event lifetimes can use Kaplan–Meier', 'survival', ['first', 'right', 'curve'], 'r:survival_km'],
  ['First-event predictor question can use Cox regression', 'survival', ['first', 'right', 'cox'], 'r:survival_cox'],
  ['A lifetime distribution or B10 question uses a parametric model', 'survival', ['first', 'right', 'distribution'], 'r:survival_parametric'],
  ['Left or interval censoring uses a supported parametric likelihood', 'survival', ['first', 'interval'], 'r:survival_parametric'],
  ['Delayed entry must preserve the start–stop risk-set design', 'survival', ['first', 'entry'], 'g:survival_entry'],
  ['Unknown failure status must be recovered before fitting', 'survival', ['first', 'unknown'], 'g:survival_censoring'],
  ['Competing risks or dependent failure units require design review', 'survival', ['complex'], 'g:survival_design'],
  ['Fixed-temperature accelerated tests can use the available advanced model', 'survival', ['first', 'right', 'accelerated', 'constant', 'available'], 'r:survival_accelerated'],
  ['Step-stress histories cannot be replaced by a constant final temperature', 'survival', ['first', 'right', 'accelerated', 'changing'], 'g:accelerated_design'],
  ['An older Survival installation cannot silently receive advanced temperature instructions', 'survival', ['first', 'right', 'accelerated', 'constant', 'missing'], 'g:survival_beta'],
  ['Available finite-mixture lifetime analysis can explore latent components', 'survival', ['first', 'right', 'mixture', 'available'], 'r:survival_mixture'],
  ['Unavailable finite-mixture menus require an availability check', 'survival', ['first', 'right', 'mixture', 'missing'], 'g:survival_beta'],
  ['Supported positive interval counts can reach the recurrent-event analysis', 'survival', ['recurrent', 'available', 'positive'], 'r:survival_recurrent'],
  ['Zero-event intervals must not be discarded to pass a module restriction', 'survival', ['recurrent', 'available', 'zeros'], 'g:recurrent_zeros'],
  ['Pooled systems or exact event times need a specified recurrent representation', 'survival', ['recurrent', 'available', 'other'], 'g:recurrent_format'],
  ['Recurrent-event instructions require the corresponding installed menu', 'survival', ['recurrent', 'missing'], 'g:survival_beta'],
  ['The modelling entry preserves an interval-censoring likelihood', 'model', ['censored', 'first', 'interval'], 'r:survival_parametric'],
  ['The modelling entry cannot bypass the recurrent zero-count restriction', 'model', ['censored', 'recurrent', 'available', 'zeros'], 'g:recurrent_zeros'],

  // Acceptance sampling: distinguish planning, performance and a lot decision.
  ['Agreed attribute risks can generate a single-stage n/c plan', 'acceptance', ['design', 'attribute', 'agreed'], 'r:accept_create_attribute'],
  ['A preferred attribute sample size alone does not specify a plan', 'acceptance', ['design', 'attribute', 'missing'], 'g:acceptance_agreement'],
  ['An existing attribute rule is assessed rather than redesigned', 'acceptance', ['evaluate', 'attribute'], 'r:accept_analyze_attribute'],
  ['Multiple flaws are not automatically pass/fail observations', 'acceptance', ['design', 'defects'], 'g:acceptance_count_definition'],
  ['Existing defect-count rules still require consistent count units', 'acceptance', ['evaluate', 'defects'], 'g:acceptance_count_definition'],
  ['Variable plan design needs credible model inputs and agreed risks', 'acceptance', ['design', 'variable', 'ready', 'agreed'], 'r:accept_create_variable'],
  ['Variable sampling assumptions do not substitute for a risk agreement', 'acceptance', ['design', 'variable', 'ready', 'missing'], 'g:acceptance_agreement'],
  ['Unknown measurement assumptions must block variable-plan design', 'acceptance', ['design', 'variable', 'uncertain'], 'g:acceptance_variable_assumptions'],
  ['An existing n/k rule is evaluated under its measurement assumptions', 'acceptance', ['evaluate', 'variable', 'ready'], 'r:accept_analyze_variable'],
  ['Unknown measurement assumptions also block variable-plan evaluation', 'acceptance', ['evaluate', 'variable', 'uncertain'], 'g:acceptance_variable_assumptions'],
  ['Observed measurements can use the agreed k-method lot decision', 'acceptance', ['decide', 'variable', 'ready'], 'r:accept_decide_variable'],
  ['Lot measurements do not remove the variable-plan assumptions', 'acceptance', ['decide', 'variable', 'uncertain'], 'g:acceptance_variable_assumptions'],
  ['Observed attribute counts need the manual n/c/r comparison, not a fabricated JASP screen', 'acceptance', ['decide', 'attribute'], 'g:attribute_lot_decision'],
  ['A lot result cannot retrospectively create its inspection rule', 'acceptance', ['decide', 'none'], 'g:acceptance_agreement'],
  ['Single-lot Bayesian evidence uses the available Beta-Binomial analysis', 'acceptance', ['bayesian', 'single', 'available', 'ready'], 'r:accept_bayesian_single'],
  ['An ordered lot sequence uses the available state-space analysis', 'acceptance', ['bayesian', 'sequence', 'available', 'ready'], 'r:accept_bayesian_sequence'],
  ['Single-lot Bayesian guidance must check installed beta availability', 'acceptance', ['bayesian', 'single', 'missing'], 'g:acceptance_beta'],
  ['State-space guidance must check installed beta availability', 'acceptance', ['bayesian', 'sequence', 'missing'], 'g:acceptance_beta'],
  ['Bayesian single-lot inference cannot proceed with unresolved counts or priors', 'acceptance', ['bayesian', 'single', 'available', 'missing'], 'g:acceptance_bayes_inputs'],
  ['Bayesian sequence inference cannot proceed with unresolved counts or priors', 'acceptance', ['bayesian', 'sequence', 'available', 'missing'], 'g:acceptance_bayes_inputs'],
];
for (const [name, goal, picks, expected] of cases) {
  const actual = walk(goal, picks);
  check(actual && actual.current === expected && actual.history.length === picks.length,
    `${name}: expected ${expected}; got ${actual?.current || '(no result)'}.`);
}

// Validate review cards and their internal navigation/source references.
for (const [id, guard] of Object.entries(GUARDS)) {
  check(nonempty(guard.title) && nonempty(guard.summary), `Review ${id}: missing title or explanation.`);
  check(array(guard.steps) && guard.steps.length > 0 && guard.steps.every(nonempty), `Review ${id}: no actionable steps.`);
  for (const goal of guard.goals || []) check(own(GOALS, goal), `Review ${id}: unknown goal ${goal}.`);
  for (const analysis of guard.analyses || []) check(own(analyses, analysis), `Review ${id}: unknown analysis ${analysis}.`);
  for (const reference of guard.sources || []) check(own(REFERENCES, reference), `Review ${id}: unknown source ${reference}.`);
}

const seenURLs = new Set();
function validURL(url, context) {
  try {
    const parsed = new URL(url);
    check(parsed.protocol === 'https:' && nonempty(parsed.hostname) && !parsed.username && !parsed.password,
      `${context}: source must be a credential-free HTTPS URL: ${url}`);
    seenURLs.add(url);
  } catch {
    check(false, `${context}: malformed source URL: ${url}`);
  }
}
for (const [id, reference] of Object.entries(REFERENCES)) {
  check(nonempty(reference.title), `Reference ${id}: missing title.`);
  validURL(reference.url, `Reference ${id}`);
}

const usedExamples = new Set();
function validateSample(sample, expectedColumns, context) {
  if (sample === null) {
    check((expectedColumns || []).length === 0,
      `${context}: settings-only example must not advertise required data columns.`);
    return;
  }
  if (!check(nonempty(sample) && own(examples, sample), `${context}: missing sample dataset ${sample}.`)) return;
  usedExamples.add(sample);
  const actual = examples[sample].columns;
  for (const name of expectedColumns || []) {
    check(actual.includes(name), `${context}: expected column ${name} is absent from sample ${sample}.`);
  }
}
for (const [id, analysis] of Object.entries(analyses)) {
  check(analysis.id === id, `Analysis ${id}: id field differs from object key.`);
  check(own(GOALS, analysis.family), `Analysis ${id}: unknown family ${analysis.family}.`);
  for (const field of ['title', 'summary', 'why']) check(nonempty(analysis[field]), `Analysis ${id}: missing ${field}.`);
  check(array(analysis.path) && analysis.path.length > 0 && analysis.path.every(nonempty), `Analysis ${id}: missing JASP menu path.`);
  check(array(analysis.setup) && analysis.setup.length > 0 && analysis.setup.every(step => nonempty(step.title) && nonempty(step.text)),
    `Analysis ${id}: incomplete setup instructions.`);
  for (const field of ['checks', 'report']) {
    check(array(analysis[field]) && analysis[field].length > 0 && analysis[field].every(nonempty),
      `Analysis ${id}: missing ${field} guidance.`);
  }
  check(array(analysis.columns) && analysis.columns.every(column =>
    nonempty(column.name) && nonempty(column.type) && nonempty(column.description)), `Analysis ${id}: incomplete column definitions.`);
  const expectedColumns = (analysis.columns || []).map(column => column.name);
  check(new Set(expectedColumns).size === expectedColumns.length, `Analysis ${id}: duplicate column definitions.`);
  validateSample(analysis.example?.sample, expectedColumns, `Analysis ${id}`);
  check(nonempty(analysis.example?.title) && nonempty(analysis.example?.story), `Analysis ${id}: missing example context.`);
  check(array(analysis.example?.instructions) && analysis.example.instructions.length > 0 && analysis.example.instructions.every(nonempty),
    `Analysis ${id}: no usable example instructions.`);
  if (analysis.availability !== undefined) {
    const availability = analysis.availability;
    check(availability && typeof availability === 'object' && !array(availability), `Analysis ${id}: invalid availability metadata.`);
    for (const field of ['module', 'sourceVersion', 'note']) {
      check(nonempty(availability?.[field]), `Analysis ${id}: availability lacks ${field}.`);
    }
    check(['released', 'beta', 'source-verified'].includes(availability?.status),
      `Analysis ${id}: availability status must be released, beta, or source-verified.`);
  }
  check(array(analysis.sources) && analysis.sources.length > 0, `Analysis ${id}: no source attribution.`);
  for (const source of analysis.sources || []) {
    check(nonempty(source.title), `Analysis ${id}: source lacks a title.`);
    validURL(source.url, `Analysis ${id}`);
  }
  for (const related of analysis.related || []) {
    check(own(analyses, related.id), `Analysis ${id}: broken related-analysis link ${related.id}.`);
    check(nonempty(related.label), `Analysis ${id}: related-analysis link ${related.id} lacks a label.`);
  }
}

for (const [id, scenario] of Object.entries(SCENARIOS)) {
  check(own(GOALS, scenario.goal), `Scenario ${id}: unknown goal ${scenario.goal}.`);
  check(own(analyses, scenario.result), `Scenario ${id}: unknown advertised result ${scenario.result}.`);
  check(array(scenario.picks), `Scenario ${id}: no scripted answers.`);
  const actual = walk(scenario.goal, scenario.picks);
  check(actual && actual.current === `r:${scenario.result}` && actual.history.length === scenario.picks.length,
    `Scenario ${id}: route reaches ${actual?.current}, not advertised r:${scenario.result}.`);
  const columns = (analyses[scenario.result]?.columns || []).map(column => column.name);
  validateSample(scenario.sample, columns, `Scenario ${id}`);
  for (const field of ['title', 'description', 'lesson']) check(nonempty(scenario[field]), `Scenario ${id}: missing ${field}.`);
}

let totalRows = 0;
for (const [id, example] of Object.entries(examples)) {
  check(example.id === id, `Dataset ${id}: id field differs from object key.`);
  check(nonempty(example.title) && /synthetic|simulat/i.test(example.description || ''), `Dataset ${id}: must explicitly disclose synthetic data.`);
  check(array(example.columns) && example.columns.length > 0 && new Set(example.columns).size === example.columns.length,
    `Dataset ${id}: empty/duplicate columns.`);
  check(array(example.notes) && example.notes.length > 0, `Dataset ${id}: lacks interpretation notes.`);
  for (const column of Object.keys(example.units || {})) {
    check(example.columns.includes(column), `Dataset ${id}: unit refers to nonexistent column ${column}.`);
  }
  if (!check(array(example.rows) && example.rows.length > 0, `Dataset ${id}: no data rows.`)) continue;
  totalRows += example.rows.length;
  for (let index = 0; index < example.rows.length; index++) {
    const row = example.rows[index];
    check(array(row) && row.length === example.columns.length, `Dataset ${id}, row ${index + 1}: wrong number of cells.`);
    check(row.every(value => typeof value === 'string' || typeof value === 'number' && Number.isFinite(value)),
      `Dataset ${id}, row ${index + 1}: unsupported or nonfinite cell.`);
  }
}

// Confirm that the supplied examples support their advertised statistical
// structures, including denominator consistency and experimental replication.
function sampleRows(id) {
  const example = examples[id];
  return example.rows.map(row => Object.fromEntries(example.columns.map((column, index) => [column, row[index]])));
}
for (const id of ['passfail', 'passfail_varying']) {
  const rows = sampleRows(id);
  check(rows.every(row => Number.isInteger(row.rejected) && Number.isInteger(row.inspected)
    && row.inspected > 0 && row.rejected >= 0 && row.rejected <= row.inspected), `${id}: invalid binomial count/denominator.`);
  check((new Set(rows.map(row => row.inspected)).size === 1) === (id === 'passfail'), `${id}: exposure pattern contradicts its chart scenario.`);
}
for (const id of ['defects', 'defects_varying']) {
  const rows = sampleRows(id);
  check(rows.every(row => Number.isInteger(row.defects) && row.defects >= 0 && row.units_inspected > 0), `${id}: invalid defect count/exposure.`);
  check((new Set(rows.map(row => row.units_inspected)).size === 1) === (id === 'defects'), `${id}: exposure pattern contradicts its chart scenario.`);
}
function tally(items) {
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
  return counts;
}
for (const [id, size] of [['subgroups', 5], ['subgroups_large', 10]]) {
  const counts = tally(sampleRows(id).map(row => row.subgroup));
  check(counts.size === 25 && [...counts.values()].every(count => count === size), `${id}: incorrect rational-subgroup layout.`);
}
const crossed = tally(sampleRows('gage').map(row => `${row.part}/${row.operator}`));
check(crossed.size === 30 && [...crossed.values()].every(count => count === 2), 'gage: not the advertised 10 × 3 × 2 crossed study.');
const owners = new Map();
for (const row of sampleRows('gage_nested')) {
  if (!owners.has(row.part)) owners.set(row.part, new Set());
  owners.get(row.part).add(row.operator);
}
check([...owners.values()].every(set => set.size === 1), 'gage_nested: a supposedly nested part is assigned to multiple operators.');
const factorial = tally(sampleRows('factorial').map(row => `${row.Temperature}/${row.Pressure}/${row.Speed}`));
check(factorial.size === 8 && [...factorial.values()].every(count => count === 2), 'factorial: not eight settings independently replicated twice.');
const surface = tally(sampleRows('surface').map(row => `${row.Temperature}/${row.Time}`));
check(surface.size === 9 && surface.get('170/30') === 5 && [...surface.entries()].every(([setting, count]) =>
  count === (setting === '170/30' ? 5 : 1)), 'surface: does not match the advertised 13-run face-centered CCD.');
check(sampleRows('contingency').reduce((sum, row) => sum + row.Count, 0) === 300,
  'contingency: aggregated counts do not represent the advertised 300 inspections.');

// Acceptance examples need valid inspection units and denominators, and their
// numerical teaching comparisons must agree with the advertised k-method rule.
const measurements = sampleRows('acceptance_measurements').map(row => row.Diameter_mm);
check(measurements.length === 24 && measurements.every(value => Number.isFinite(value) && value > 0),
  'acceptance_measurements: expected 24 finite, positive diameters from one lot.');
const diameterMean = measurements.reduce((sum, value) => sum + value, 0) / measurements.length;
const diameterVariance = measurements.reduce((sum, value) => sum + (value - diameterMean) ** 2, 0) / (measurements.length - 1);
check(diameterVariance > 0, 'acceptance_measurements: lot inspection requires a positive sample SD.');
check((diameterMean - 9.95) / 0.04 >= 1.309 && (diameterMean - 9.98) / 0.04 < 1.309,
  'acceptance_measurements: the prespecified teaching comparison should pass LSL 9.95 and fail LSL 9.98 under the known-SD k rule.');
const lotSequence = sampleRows('acceptance_lot_sequence');
check(lotSequence.length === 12 && new Set(lotSequence.map(row => row.LotOrder)).size === lotSequence.length,
  'acceptance_lot_sequence: expected twelve distinct lots.');
check(lotSequence.every((row, index) => Number.isFinite(row.LotOrder)
  && (index === 0 || row.LotOrder > lotSequence[index - 1].LotOrder)),
  'acceptance_lot_sequence: lot order must be numeric and chronological.');
check(lotSequence.every(row => ['Nonconforming', 'Tested', 'LotSize'].every(column => Number.isInteger(row[column]))
  && row.Nonconforming >= 0 && row.Tested === 100 && row.LotSize === 1000
  && row.Nonconforming <= row.Tested && row.Tested <= row.LotSize),
  'acceptance_lot_sequence: nonconforming counts, inspected samples, or lot denominators contradict the teaching story.');

const summary = `${Object.keys(GOALS).length} goals; ${reachableNodes.size} questions; ` +
  `${traversedChoices.size} distinct answer choices; ${paths.length} complete choice paths; ` +
  `${reachableAnalyses.size} recommendations; ${reachableGuards.size} review/prerequisite outcomes.`;
if (failures.length) {
  console.error(`FAIL: ${failures.length} validation problem(s).`);
  for (const failure of failures.slice(0, 60)) console.error(` - ${failure}`);
  if (failures.length > 60) console.error(` - … ${failures.length - 60} more.`);
  console.error(summary);
  process.exitCode = 1;
} else {
  console.log('PASS: Exhaustive decision routes, methodological cases, and content/data contracts.');
  console.log(summary);
  console.log(`Paths by goal: ${Object.entries(goalCounts).map(([goal, count]) => `${goal}=${count}`).join(', ')}.`);
  console.log(`${cases.length} independent methodological cases; ${Object.keys(SCENARIOS).length} guided examples; ` +
    `${usedExamples.size} referenced datasets; ${Object.keys(examples).length} datasets / ${totalRows} rows; ` +
    `${seenURLs.size} unique HTTPS source URLs.`);
  console.log(`${checks} validation assertions passed. No browser rendering or JASP execution is implied by these checks.`);
}
