/* JASP Quality Guide — original decision content, JASP Services B.V. prototype. */
'use strict';
const GOALS = {
  monitor: {title:'Monitor a process',family:'Control charts',short:'Monitoring',icon:'chart',description:'Spot shifts, unusual variation, and changes over time.',start:'m_type'},
  capability: {title:'Meet specifications',family:'Process capability',short:'Capability',icon:'target',description:'Understand whether your process can deliver within its limits.',start:'c_type'},
  measurement: {title:'Trust your measurements',family:'Measurement systems',short:'Measurement',icon:'ruler',description:'Assess repeatability, reproducibility, bias, and agreement.',start:'g_type'},
  compare: {title:'Compare processes',family:'Tests & equivalence',short:'Comparisons',icon:'compare',description:'Compare means or proportions, or show differences are small enough.',start:'h_outcome'},
  doe: {title:'Find better settings',family:'Design of experiments',short:'DOE',icon:'experiment',description:'Plan an experiment or analyse the runs you have collected.',start:'d_stage'},
  model: {title:'Understand relationships',family:'Regression & prediction',short:'Relationships',icon:'scatter',description:'Explore how process settings relate to an outcome.',start:'r_outcome'}
};
const option = (value,label,description,next) => ({value,label,description,next});
const question = (title,description,short,help,options) => ({title,description,short,help,options});
const answerMap = (history) => Object.fromEntries(history.map(x=>[x.id,x.value]));
function meanResult(h,kind) {
  const eq = answerMap(h).h_goal === 'equivalent';
  return 'r:' + ({one:eq?'eq_one':'one_t',ind:eq?'eq_ind':'ind_t',paired:eq?'eq_paired':'paired_t'})[kind];
}
const NODES = {
  m_type: question('What do you record about the process?','Choose what each observation represents. The distinction between a failed item and a defect changes the chart.','Data recorded',[
    'A continuous measurement has a meaningful numerical scale, such as millimetres, grams, or seconds.',
    'For nonconforming units, each inspected item is counted at most once. For defects, the same item can contribute several scratches, pinholes, or other nonconformities.',
    'Example: 8 rejected panels out of 100 is a count of nonconforming units. Finding 18 scratches across those panels is a count of defects.'
  ],[
    option('continuous','A continuous measurement','For example: diameter, fill volume, or cycle time.','m_order'),
    option('passfail','The number of nonconforming items','Each item is classified once: pass or fail.','m_order'),
    option('defects','The number of defects','An item can have more than one defect.','m_order')
  ]),
  m_order: question('Can you follow the process through time?','Control charts need the collection order and a meaningful stream of comparable observations.','Process order',[
    'Keep the original time or production order. Sorting the measurements from low to high destroys the pattern that a control chart is intended to reveal.',
    'Closely spaced sensor readings can be correlated. Product mixtures, seasonality, and known dependence may need separate streams or an explicit model.',
    'If you are unsure about dependence, start by plotting the observations in time order and investigate the sampling process. The guide cannot test dependence from these answers.'
  ],[
    option('ordered','Yes — the order is known','Comparable observations, with no known strong serial dependence.',h=>answerMap(h).m_type==='continuous'?'m_units':'m_denominator'),
    option('unknown','The collection order is missing','I currently have a list of values or totals.','g:order'),
    option('dependent','There is strong dependence or a mixture','For example: dense sensor readings, seasonality, or several product types.','g:monitor_dependence')
  ]),
  m_units: question('How many different items are measured at each time point?','A rational subgroup contains different items produced under similar conditions, close together in time.','Sampling structure',[
    'One item every hour is an individuals series. Five different consecutive parts every hour can form a subgroup of five.',
    'Five readings of the same part mainly tell you about measurement repeatability. They are not five independent production items.',
    'The subgroup should capture short-range variation; changes between subgroups are then visible over time. Do not create arbitrary groups after looking at the values.'
  ],[
    option('individual','One item at a time','One measurement per time point; no natural subgroup.','m_shift'),
    option('subgroups','Several different items together','For example: five consecutive parts each hour.','m_size'),
    option('samepart','The same item measured repeatedly','I take several repeat readings of one physical item.','g:repeated_item')
  ]),
  m_shift: question('What kind of change matters most?','Choose a useful starting point for monitoring a continuous measurement.','Monitoring goal',[
    'An individuals and moving-range chart is a familiar starting point for individual observations.',
    'An EWMA smooths the series by giving more weight to recent values. A CUSUM accumulates deviations from a reference. Both can help detect small sustained shifts.',
    'Their settings and baseline affect sensitivity and false alarms. Neither method automatically corrects autocorrelation.'
  ],[
    option('general','General process monitoring','Look for unusual observations and changes in variation.','r:imr'),
    option('smooth','Small sustained shifts, using a smoothed chart','Give more weight to recent measurements: EWMA.','r:ewma'),
    option('cumulative','Small shifts from an established reference','Accumulate deviations from a meaningful target: CUSUM.','r:cusum')
  ]),
  m_size: question('How large are your rational subgroups?','This is a practical chart-selection convention, not a sharp statistical boundary.','Subgroup size',[
    'X̄–R uses each subgroup mean and range; it is commonly used for small subgroups.',
    'X̄–S uses each subgroup mean and standard deviation; it is commonly preferred for larger subgroups.',
    'The labels below use 2–9 and 10 or more as a practical convention. Review the subgroup design, missing values, and software settings if sizes vary.'
  ],[
    option('small','Small subgroups: usually 2–9 items','A common starting point is an X̄–R chart.','r:xbar_r'),
    option('large','Larger subgroups: usually 10 or more items','A common starting point is an X̄–S chart.','r:xbar_s'),
    option('unequal','Subgroup sizes vary substantially','I need help checking the sampling structure.','g:subgroups')
  ]),
  m_denominator: question('Is the amount inspected the same each time?','For pass/fail data this is the number of items. For defects it is the inspection opportunity: items, area, length, or time.','Inspection amount',[
    'The numerator and denominator must describe the same sample. A percentage without the number inspected loses the information needed for control limits.',
    'A constant number of items does not imply constant defect opportunity if their sizes, operating times, or inspection coverage differ.',
    'For nonconforming items use a p chart when the denominator varies. For multiple defects use a u chart when the amount inspected varies.'
  ],[
    option('constant','Yes — a fixed, known amount','The sampling and inspection opportunities are comparable.',h=>answerMap(h).m_type==='passfail'?'r:np_chart':'r:c_chart'),
    option('varying','No — it varies, and I know each amount','I have both the count and its denominator or exposure.',h=>answerMap(h).m_type==='passfail'?'r:p_chart':'r:u_chart'),
    option('missing','I only have counts or percentages','The amount inspected is missing or uncertain.','g:denominator')
  ]),
  c_type: question('What kind of output has a specification?','This capability route is for a measured quality characteristic.','Output type',[
    'For a continuous characteristic, specifications might require diameter between 9.95 and 10.05 mm, or cycle time below 60 seconds.',
    'For pass/fail output, estimate the nonconforming proportion and its uncertainty. For defects, work with counts and exposure. Normal Cp and Cpk are not appropriate summaries of those counts.'
  ],[
    option('continuous','A continuous measurement','For example: dimensions, fill volume, strength, or time.','c_specs'),
    option('attribute','Pass/fail items or defect counts','My outcome is a count or a proportion.','g:attribute_capability')
  ]),
  c_specs: question('Which acceptance limits are defined?','Use requirements from the product, customer, or engineering specification.','Specifications',[
    'A target is the preferred value. A specification limit is the boundary of acceptable output. A target alone does not tell you what is acceptable.',
    'A one-sided specification is valid: for example, cycle time must be no more than 60 seconds. Do not create an artificial lower limit.',
    'Control limits are estimated from process behaviour; they are not substitutes for engineering specification limits.'
  ],[
    option('two','A lower and an upper specification limit','For example: fill volume from 490 to 510 mL.','c_stability'),
    option('one','Only one genuine specification limit','For example: cycle time must be below 60 seconds.','c_stability'),
    option('target','Only a target, or no agreed limits','Acceptable output has not yet been defined.','g:specifications')
  ]),
  c_stability: question('Has process stability been examined?','Capability concerns a defined process under conditions that are expected to continue.','Process stability',[
    'A histogram hides the order of the data. First inspect time-ordered measurements, relevant control charts, and known process changes.',
    'An absence of chart signals is not proof of stability. Consider the baseline, the amount of data, sampling, and process knowledge.',
    'For an unstable process, sample summaries remain descriptive, but a single capability index is not a dependable forecast of future output.'
  ],[
    option('checked','Yes — the process appears stable','Time-order diagnostics and process knowledge support a coherent baseline.','c_model'),
    option('unchecked','Not yet, or I am not sure','I have not checked the pattern over time.','g:stability'),
    option('unstable','There are shifts or unresolved special causes','The data combine materially different process conditions.','g:stability')
  ]),
  c_model: question('What describes the measurement distribution?','Use process knowledge and plots, paying attention to the tails near the specification limits.','Distribution model',[
    'A normal model may be reasonable for a single stable, approximately symmetric process. A nonsignificant normality test does not establish this.',
    'Skewed positive measurements, such as cycle times, may require a different distribution or a justified transformation.',
    'Do not use a fitted skewed distribution to conceal process mixtures, time trends, censoring, or measurement problems.'
  ],[
    option('normal','A normal model is plausible','A single roughly symmetric population, with suitable tail fit.','r:cap_normal'),
    option('skew','The distribution is clearly skewed or otherwise nonnormal','A fitted distribution or transformation needs consideration.','r:cap_nonnormal'),
    option('unsure','I need to examine the distribution first','I have not yet assessed shape, mixtures, or tail fit.','g:distribution')
  ]),
  g_type: question('What does the measurement system produce?','Separate numerical measurement variation from agreement on categories.','Measurement type',[
    'A numerical instrument returns a measured value, such as diameter in millimetres.',
    'An inspector or classification system returns a category, such as Pass/Fail or a defect class. Agreement between raters differs from agreement with a trusted standard.'
  ],[
    option('continuous','A continuous measurement','For example: a micrometer, scale, or strength tester.','g_question'),
    option('categorical','A category or pass/fail judgement','For example: inspectors classifying the same parts.','r:attribute_agreement')
  ]),
  g_question: question('What do you want to learn about the instrument?','Choose the question that matches the study you can conduct.','Study purpose',[
    'A Type 1 study uses repeated readings of one reference under fixed conditions to examine instrument repeatability and bias.',
    'A linearity study uses several accepted reference values across the working range to examine whether bias changes with magnitude.',
    'Gauge R&R separates measurement variation across parts, operators, and repeat readings. The design determines which sources can be separated.'
  ],[
    option('rr','Variation across parts and operators','Separate repeatability and reproducibility with a Gauge R&R study.','g_parts'),
    option('one','Repeatability and bias at one reference value','One accepted reference, measured repeatedly.','r:gage_type1'),
    option('linearity','Whether bias changes across the range','Several accepted reference values spanning the working range.','r:gage_linearity')
  ]),
  g_parts: question('Which parts does each operator measure?','Part allocation determines whether the design is crossed or nested.','Part allocation',[
    'Crossed: every operator measures the same parts. Nested: each operator measures a different set of parts.',
    'Destructive measurements require careful design. They do not automatically imply nesting: homogeneous batches may be represented across all operators.',
    'If specimen differences cannot be separated from instrument variation, a standard repeatability estimate may not be identifiable.'
  ],[
    option('crossed','Every operator measures the same parts','The parts remain available for repeat measurements.','g_repeats_crossed'),
    option('nested','Each operator measures a different set of parts','Part identifiers belong to one operator only.','g_repeats_nested'),
    option('destructive','Measurement destroys or changes the specimen','For example: breaking a component in a strength test.','g_destructive')
  ]),
  g_repeats_crossed: question('Are there repeat measurements of each part by each operator?','Replication is needed to separate repeatability from other variation.','Replication',[
    'For example, 10 parts × 3 operators × 2 readings produces 60 measurements.',
    'Randomize the measurement order where feasible, and avoid letting operators see their earlier readings.',
    'One reading of each unique part does not provide the same information as repeat readings of the same part.'
  ],[
    option('yes','Yes — each operator–part combination is repeated','I can use a balanced crossed Gauge R&R study.','r:gage_crossed'),
    option('no','No — there is only one reading per combination','I need to reconsider what the design can estimate.','g:replication')
  ]),
  g_repeats_nested: question('Can repeatability be estimated within each part group?','Use balanced replication and a defensible definition of a repeated or equivalent specimen.','Within-part replication',[
    'For nondestructive measurements, repeat readings can be taken on each part.',
    'For destructive measurements, a part group can represent a sufficiently homogeneous batch of equivalent specimens. That homogeneity must be justified independently.',
    'Nested analysis cannot magically remove real differences between the specimens treated as replicates.'
  ],[
    option('yes','Yes — repeated readings or homogeneous specimens','Each operator has equal numbers of part groups and repeated observations.','r:gage_nested'),
    option('no','No, or specimen equivalence is uncertain','Differences between specimens may be confounded with measurement variation.','g:replication')
  ]),
  g_destructive: question('How are homogeneous batches allocated to operators?','Only treat specimens as replicates when their equivalence is defensible.','Destructive-study structure',[
    'If every operator tests specimens from every homogeneous batch, the batch factor can be crossed with operator.',
    'If each homogeneous batch is assigned to just one operator, the batch factor is nested in operator.',
    'If there are no credible homogeneous specimen groups, seek a more specific measurement-system design.'
  ],[
    option('nested','Different homogeneous batches for each operator','Each batch belongs to one operator.','g_repeats_nested'),
    option('crossed','Every operator receives specimens from each batch','The batch factor is crossed with operator.','g:destructive_crossed'),
    option('unknown','Homogeneity or allocation is uncertain','I cannot yet justify equivalent specimens.','g:replication')
  ]),
  h_outcome: question('What is the outcome you want to compare?','Start with what is measured, then identify the comparison and the study structure.','Outcome type',[
    'A continuous outcome can be summarised by a mean, such as shaft diameter.',
    'Pass/fail data compare proportions. Several unordered categories compare category distributions.',
    'Ordered ratings, defect counts, and repeated or clustered outcomes may need a more specific analysis. Do not choose a mean comparison merely because the categories have numerical codes.'
  ],[
    option('continuous','A continuous measurement','For example: strength, diameter, volume, or time.','h_goal'),
    option('binary','A pass/fail outcome','Each item has one of two possible outcomes.','h_binary'),
    option('categories','Several unordered categories','For example: the type of defect across suppliers.','h_categories'),
    option('other','Counts, ordered ratings, or another outcome','The measurement is not covered by the simple routes above.','g:other_outcome')
  ]),
  h_goal: question('What does a useful conclusion look like?','Detecting a difference and establishing practical equivalence answer different questions.','Comparison purpose',[
    'A difference test addresses a specified difference, often zero. An equivalence test asks whether the difference is small enough to fall inside prespecified acceptable bounds.',
    'A nonsignificant difference test does not establish equivalence. A failed equivalence test can also be inconclusive.',
    'Equivalence of means is not the same as equivalence of variation or proof that individual items meet specifications.'
  ],[
    option('difference','Assess a difference in means','Estimate the difference and test a specified reference.','h_structure'),
    option('equivalent','Show that any mean difference is acceptably small','Define practical equivalence bounds before examining the result.','h_structure')
  ]),
  h_structure: question('How are the observations related?','Matching comes from the study design, not from equal sample sizes.','Comparison design',[
    'Independent groups contain different items. Paired measurements concern the same items or genuine matched pairs.',
    'For example, the same components measured before and after an adjustment are paired. Two equally sized shipments from different suppliers are not automatically paired.',
    'Multiple items within the same batch or repeated readings of the same machine may create additional clustering; a simple independent test can then overstate the information.'
  ],[
    option('one','One sample compared with a reference value','For example: is the mean fill weight close to 500 g?',h=>meanResult(h,'one')),
    option('ind','Two independent groups','Different items in each group.',h=>meanResult(h,'ind')),
    option('paired','Two matched conditions','The same items before/after, or genuine matched pairs.',h=>meanResult(h,'paired')),
    option('many','More than two groups or conditions','Choose independent or repeated conditions next.',h=>answerMap(h).h_goal==='equivalent'?'g:multiple_equivalence':'h_many'),
    option('complex','There is additional clustering or dependence','For example: many items per batch or many readings per machine.','g:dependence')
  ]),
  h_many: question('Are the same items observed in every condition?','This determines whether to use independent-group or repeated-measures ANOVA.','Multi-group design',[
    'Independent groups contain different items under each setting or from each machine.',
    'Repeated measures use the same items under all conditions. The measurements within an item are related.',
    'With incomplete repeated designs, nested sampling, or several crossed grouping factors, use a model that represents that structure.'
  ],[
    option('ind','No — different items in each group','One grouping factor, with independent observations.','r:one_anova'),
    option('repeated','Yes — the same items in every condition','A complete repeated-measures design.','r:rm_anova'),
    option('complex','The design is incomplete or more complex','There are missing conditions, clusters, or several dependencies.','g:dependence')
  ]),
  h_binary: question('How are the pass/fail observations organised?','Ordinary tests of proportions assume the relevant units are independent.','Binary-data design',[
    'One sample can be compared with a prespecified proportion using a binomial test.',
    'For independent groups, a contingency table compares the outcome distributions. Enter the actual counts, not percentages.',
    'Pass/fail outcomes on the same items before and after are paired; an ordinary independent contingency-table test ignores that pairing.'
  ],[
    option('one','One independent sample versus a reference proportion','For example: compare the nonconforming fraction with 5%.','r:binomial'),
    option('groups','Two or more independent groups','For example: pass/fail counts from several suppliers.','r:contingency'),
    option('paired','The same items under two conditions','Each item has both a before and an after classification.','g:paired_binary'),
    option('clustered','Items are clustered or repeatedly classified','For example: items within batches or repeated observations.','g:dependence')
  ]),
  h_categories: question('Are the category observations independent across groups?','A contingency table uses a count for every group–category combination.','Categorical-data design',[
    'Each item should contribute once to the table for a standard independent-samples comparison.',
    'An ordered rating has structure that a generic nominal-category test does not use.',
    'If several raters classify the same items and agreement is the goal, choose measurement systems → categorical judgements.'
  ],[
    option('ind','Yes — separate items in each group','I have raw categories or aggregated cell counts.','r:contingency'),
    option('paired','No — the same items are classified repeatedly','Pairing or repeated classifications need to be retained.','g:paired_binary')
  ]),
  d_stage: question('Are you planning an experiment or analysing one?','A designed experiment deliberately changes factors to learn about their effects.','Experiment stage',[
    'A worksheet defines settings and a run plan before you collect the response.',
    'An analysis uses the actual run settings and responses. Preserve randomisation order, blocks, independent run replication, and any deviations from the plan.',
    'Production records collected without controlled settings are observational data, even if they contain many process variables.'
  ],[
    option('plan','Plan an experiment','Choose factor settings and generate a run worksheet.','d_goal'),
    option('analyse','Analyse measurements from completed runs','Use the recorded design and responses.','d_history')
  ]),
  d_goal: question('What should the experiment help you learn?','Screening and optimisation usually call for different designs.','Experiment purpose',[
    'A two-level factorial design can estimate main effects and supported interactions over selected low and high settings.',
    'Centre points help assess curvature. Estimating separate quadratic effects requires a suitable response-surface design or augmentation.',
    'Confirmation means testing a proposed improvement in new independent runs; it is distinct from using the same runs to find the setting.'
  ],[
    option('screen','Which factors and interactions matter?','Screen or compare settings over a chosen operating range.','d_factorial'),
    option('optimise','Where are useful settings, including curvature?','Build a response surface for continuous controllable factors.','d_surface'),
    option('confirm','Does a proposed improvement hold up?','Plan independent confirmation runs.','g:confirmation')
  ]),
  d_factorial: question('Can the proposed factor combinations be run?','Consider feasibility and restrictions before generating a design.','Factorial feasibility',[
    'Choose meaningful low and high levels. Full factorial designs examine all combinations; fractional designs reduce runs while aliasing some effects.',
    'Randomisation protects against nuisance changes. Blocks can represent known run groups, such as days or material batches.',
    'Hard-to-change factors, forbidden combinations, mixtures, and split-plot restrictions may require a specialised design.'
  ],[
    option('feasible','Yes — meaningful low and high levels are feasible','I can plan randomisation and any justified blocks.','r:doe_factorial'),
    option('restricted','There are strong practical restrictions','For example: hard-to-change factors, mixtures, or forbidden combinations.','g:restricted_doe')
  ]),
  d_surface: question('Are the factors continuous and the design region feasible?','Response-surface models require enough information to estimate curvature.','Response-surface feasibility',[
    'A central composite design combines factorial, axial, and centre points. A Box–Behnken design uses another arrangement for fitting quadratic models.',
    'Axial points can extend beyond the factorial low/high levels. A face-centred central composite design keeps axial points at the faces of that region.',
    'Feasibility is not the only design criterion. Consider precision, blocks, randomisation, replication, and the region where predictions matter.'
  ],[
    option('continuous','Yes — continuous factors and feasible settings','I can check all proposed runs before conducting them.','r:doe_surface'),
    option('restricted','There are categorical factors or constraints','A more specific design choice is needed.','g:restricted_doe')
  ]),
  d_history: question('What kind of experimental data do you have?','The standard analysis route covers factorial and response-surface designs with a continuous response.','Data origin',[
    'Retain actual factor settings, responses, run order, blocks, and which runs were true independent replications.',
    'Several readings from one run are subsamples, not independent run replication.',
    'If factors drifted together in routine production, a regression can describe associations, but causal interpretation requires additional justification.'
  ],[
    option('designed','A standard factorial or response-surface experiment','A continuous response; run settings, blocks, and replication are recorded.','r:doe_analyze'),
    option('special','A specialised design or a different response type','For example: split plots, mixtures, binary outcomes, or counts.','g:restricted_doe'),
    option('observational','No — these are routine production records','Settings were not assigned as an experiment.','g:observational_doe'),
    option('unknown','The design information is incomplete','I need to reconstruct the run plan and experimental units.','g:design_information')
  ]),
  r_outcome: question('What kind of response are you trying to explain?','The outcome scale helps determine the model family.','Response type',[
    'A linear model concerns a continuous response conditional on predictors. A binary logistic model concerns the probability of one of two outcomes.',
    'Counts need a suitable count model and possibly exposure. Time-to-event data may contain censoring.',
    'A generalised linear model is not a general-purpose nonlinear least-squares procedure. A physical nonlinear response may need a more specific implementation.'
  ],[
    option('continuous','A continuous response','For example: yield, thickness, or strength.','r_structure'),
    option('binary','A binary response','For example: whether an individual item is nonconforming.','r_structure'),
    option('count','A count or rate','For example: defects per area or failures per operating hour.','g:count_model'),
    option('censored','A lifetime or a more specialised response','For example: right-censored failure times.','g:special_model')
  ]),
  r_structure: question('Are the observations independent at the relevant level?','A basic regression needs the data structure to match its error model.','Observation structure',[
    'One independent run per row differs from many readings taken on the same machine or within the same batch.',
    'With serial dependence or seasonality, ordinary regression errors may be dependent even after including process settings.',
    'Inspect residuals and the sampling structure. Normality of the raw response is not the assumption that determines whether a linear model is appropriate.'
  ],[
    option('ind','A basic independent-observations model is plausible','No known repeated-unit, batch, or time-series dependence.','r_goal'),
    option('clustered','There are repeated units or clusters','For example: readings nested within machines or batches.','g:dependence'),
    option('time','There is strong time-series dependence','For example: autocorrelation or seasonality.','g:regression_dependence')
  ]),
  r_goal: question('What will you use the model for?','Interpretation depends on how the data were collected and how the model will be used.','Model purpose',[
    'A model can describe associations or make predictions without establishing what would happen under an intervention.',
    'For prediction, assess performance on genuinely held-out observations, keeping related observations together when relevant.',
    'If you need to establish whether changing a setting causes an improvement, a suitably designed experiment is often the next step.'
  ],[
    option('association','Describe adjusted relationships','Estimate how the response is associated with the recorded predictors.',h=>answerMap(h).r_outcome==='binary'?'r:logistic_regression':'r:linear_regression'),
    option('prediction','Predict new observations','Assess performance beyond the data used to fit the model.',h=>answerMap(h).r_outcome==='binary'?'r:logistic_regression':'r:linear_regression'),
    option('causal','Establish the effect of changing a setting','I need evidence to justify a process intervention.','g:causality')
  ])
};
const GUARDS = {
  order:{title:'Recover the collection order first',summary:'A control chart needs the process sequence. A sorted list or a single aggregate cannot reveal when a change occurred.',steps:['Recover time stamps, run numbers, or the original production order from your records.','Define comparable observations or rational subgroups and retain their inspection amounts.','Use Descriptives → Descriptive Statistics to inspect the distribution while reconstructing the sequence; this does not replace a control chart.'],goals:['monitor'],sources:['nist_charts']},
  monitor_dependence:{title:'Define a suitable process stream first',summary:'Standard control limits can be misleading when observations are strongly dependent or combine different processes.',steps:['Separate products or operating regimes when they represent different process populations.','Examine the time pattern and how frequently observations are collected.','Consider an appropriate time-series or residual-monitoring model with someone who can review the sampling process. EWMA or CUSUM alone does not solve autocorrelation.'],goals:['model'],sources:['nist_charts']},
  repeated_item:{title:'Separate instrument repeats from production items',summary:'Repeated readings of one part describe measurement repeatability. They do not form a subgroup of independent production items.',steps:['If the question is instrument repeatability or reproducibility, use the measurement-systems route.','For production monitoring, define a sampling plan using different items at each subgroup or a valid individuals series.','Retain part identifiers and the distinction between repeated readings and new items.'],goals:['measurement','monitor'],sources:['qc_menu']},
  subgroups:{title:'Check the subgroup design and missing values',summary:'Subgroup size affects the precision of the mean and variation estimates. Unequal sizes require deliberate settings and interpretation.',steps:['Retain every subgroup identifier and its actual number of observations.','Check whether variable sizes are intended, caused by missing readings, or caused by mixing process conditions.','JASP provides subgroup variables charts, but this first version does not automatically choose settings for substantially unequal subgroup sizes. Review the installed analysis help before proceeding.'],analyses:['xbar_r','xbar_s'],sources:['qc_menu','nist_charts']},
  denominator:{title:'Retrieve the amount inspected',summary:'Counts and percentages have different precision at different inspection amounts. The denominator is needed to select and set up the chart.',steps:['For nonconforming units, retrieve the count rejected and the number inspected in every sample.','For defects, retrieve the number of defects and a consistent measure of opportunity: items, area, length, or exposure time.','Check that a nonconforming-unit count is no greater than the number inspected. A defect count may exceed the number of items.'],goals:['monitor'],sources:['nist_attributes']},
  attribute_capability:{title:'Assess nonconformance using counts and denominators',summary:'Normal Cp and Cpk apply to continuous measurements under a suitable model. They are not the route for pass/fail or defect counts.',steps:['For independent pass/fail units, estimate the nonconforming fraction and its uncertainty; a binomial test can address a prespecified reference proportion.','For monitoring, use p/np charts for nonconforming units and c/u charts for defects with appropriate inspection amounts.','Compare the relevant probability or rate with the acceptance requirement. Count-data capability options are not part of this guide’s verified module baseline.'],analyses:['binomial','p_chart','u_chart'],sources:['qc_menu','nist_attributes']},
  specifications:{title:'Define acceptable output first',summary:'A preferred target does not define the boundaries of acceptable output. Capability indices need genuine specification limits.',steps:['Confirm the engineering, customer, or functional acceptance limits and their units.','A real upper or lower limit is enough for a one-sided assessment. Do not invent the other limit.','If your immediate question is whether the mean differs from a target, use a one-sample comparison; that answers a different question from capability.'],goals:['compare'],analyses:['one_t'],sources:['nist_capability']},
  stability:{title:'Examine stability before forecasting capability',summary:'Investigate the process over time before treating one capability summary as representative of future output.',steps:['Choose a control chart that matches the measurement and sampling structure.','Investigate unresolved shifts, changes in variation, product mixtures, and known special causes.','A capability summary can describe the observed sample, but unstable output does not support a dependable prediction of future capability. Return here when a coherent baseline is justified.'],goals:['monitor'],sources:['nist_capability','nist_stability']},
  distribution:{title:'Examine the distribution before choosing capability settings',summary:'The fitted tails determine the estimated nonconforming probability. A shape decision should use process knowledge and diagnostic plots.',steps:['Inspect a histogram and a Q–Q or probability plot, and check for mixtures, time trends, rounding, and censoring.','In Quality Control → Capability Analysis → Process Capability Study, inspect the distribution and diagnostic options before interpreting the indices.','Choose a plausible model or transformation and examine fit near the specification limits. Do not choose solely from a normality-test p-value.'],analyses:['cap_normal','cap_nonnormal'],sources:['qc_capability','nist_capability']},
  replication:{title:'Review the measurement-study design',summary:'Without suitable replication, instrument repeatability may be confounded with operator, part, or specimen variation.',steps:['Identify the physical part, operator, repeated reading, and any batch of nominally equivalent specimens.','Plan repeat readings or independently justify specimen homogeneity for destructive measurements.','Check which variance components the design can identify before collecting more data. A standard Gauge R&R label cannot repair an unidentified design.'],goals:['measurement'],sources:['qc_nested','destructive']},
  destructive_crossed:{title:'Treat this as a crossed batch design, subject to homogeneity',summary:'Destructive testing does not automatically imply a nested design. Every operator receiving specimens from every batch can create a crossed structure.',steps:['Establish whether specimens within each batch are sufficiently equivalent for the intended measurement-system assessment.','Use batch as the shared part-group factor and retain individual specimen and operator identifiers.','Review whether the standard crossed Gauge R&R assumptions describe this study. Specimen differences can inflate apparent repeatability; obtain design-specific advice if homogeneity is uncertain.'],analyses:['gage_crossed'],sources:['destructive']},
  other_outcome:{title:'Choose a model for the actual measurement scale',summary:'This first version covers common continuous-mean and categorical-proportion comparisons. Counts and ordered ratings need their own interpretation.',steps:['For counts, record any exposure and consider a suitable count model; for monitoring, use the control-chart route.','For ordered ratings, decide whether the target is a distributional difference, an ordinal effect, or agreement between raters.','JASP contains additional rank-based and generalised models. This prototype does not automatically select among those designs or treat a rank test as an interchangeable test of means.'],goals:['monitor','measurement'],sources:['jasp_features']},
  multiple_equivalence:{title:'Define the equivalence claim across groups',summary:'With more than two groups, “all means are close enough” needs explicit contrasts, bounds, and a joint decision rule.',steps:['Specify which differences matter, in measurement units, before examining results.','Decide whether the claim concerns every pair, comparisons with one reference, or a planned contrast.','The individual equivalence t tests in this guide do not by themselves constitute a complete multi-group equivalence procedure. Plan the simultaneous inference with a methodologist.'],analyses:['eq_ind','eq_paired'],sources:['jasp_equivalence']},
  dependence:{title:'Represent the repeated or clustered structure',summary:'A simple independent-observations analysis can overstate precision when several records come from the same machine, batch, part, or person.',steps:['Identify the experimental unit and the levels at which settings were assigned or sampled.','Retain grouping IDs, repeated-measure occasions, and the difference between run replication and subsampling.','JASP’s Mixed Models module may be appropriate, but its random effects and error structure need a design-specific choice. This prototype stops before choosing that model for you.'],goals:['compare','model'],sources:['jasp_features']},
  paired_binary:{title:'Keep the pairing in a categorical comparison',summary:'An independent contingency-table test is not the right default for repeated classifications of the same items.',steps:['For binary before/after data, a McNemar analysis uses the paired table and its discordant cells. Availability depends on the installed Frequencies module; this guide does not assume a beta option is installed.','For an exact two-condition binary test, a binomial test of the direction of change among discordant pairs can implement exact McNemar. This requires deliberate data restructuring and interpretation.','For rater agreement, use Attributes Agreement Analysis. For more categories or repeated occasions, choose a model for the full repeated design.'],analyses:['attribute_agreement'],sources:['jasp_frequencies']},
  confirmation:{title:'Plan new runs to confirm the proposed improvement',summary:'A candidate optimum found in one experiment should be evaluated with independent confirmation runs.',steps:['Prespecify the proposed settings, comparison setting, meaningful improvement, and primary response.','Plan enough independent runs, with appropriate randomisation and blocking, to quantify the uncertainty.','If comparing two settings, select a test that matches the independent or paired structure. If confirming specification performance, also examine stability and capability.'],goals:['compare','capability'],sources:['qc_doe']},
  restricted_doe:{title:'Match the design to the operating constraints',summary:'Standard factorial or response-surface worksheets may not represent hard-to-change factors, mixtures, prohibited runs, or other strong restrictions.',steps:['Document the factor types, permissible combinations, and the experimental unit at each randomisation level.','Identify blocking, split-plot, mixture, or optimal-design requirements before choosing a run plan.','JASP’s worksheet tools remain useful for supported designs. This first version does not automatically solve specialised or constrained design selection.'],analyses:['doe_factorial','doe_surface'],sources:['qc_doe']},
  observational_doe:{title:'Use an observational model for production records',summary:'Routine production data can reveal useful associations, but they do not acquire randomised-experiment properties when entered in a DOE analysis.',steps:['Inspect the data, identify confounding and dependence, and choose a model for the outcome scale.','Preserve batch, machine, and time identifiers so the sampling structure can be represented.','Use a designed experiment if the decision requires evidence about changing a controllable factor.'],goals:['model','doe'],sources:['qc_doe','nist_residuals']},
  design_information:{title:'Reconstruct the experimental units and run plan',summary:'The response column alone is not enough to identify the intended experimental analysis.',steps:['Recover actual factor settings, blocks, randomisation order, centre points, and deviations from the plan.','Distinguish independent run replications from repeated readings or subsamples within one run.','Check aliasing and which effects the design can estimate before fitting a larger model.'],analyses:['doe_analyze'],sources:['qc_doe']},
  count_model:{title:'Use a suitable count or rate model',summary:'Counts often need a Poisson, negative-binomial, or another appropriate model rather than ordinary linear regression.',steps:['Retain the count and any exposure, such as operating time or inspected area. Exposure may need to enter the model as an offset.','Check the mean–variance relationship, extra zeros, dependence, and whether a count interpretation is appropriate.','JASP provides generalised modelling tools, but this first version does not automate family, dispersion, or exposure-offset settings. Use the installed module help for the specific analysis.'],goals:['monitor'],sources:['jasp_features']},
  special_model:{title:'Choose a model that respects the response structure',summary:'Censoring, physical nonlinear relationships, and other specialised outcomes require more than a generic regression choice.',steps:['For lifetimes, preserve event status and censoring time; do not treat censored times as observed failures.','For a physical nonlinear model, specify the model and parameters; a generalised linear model is not a substitute for arbitrary nonlinear least squares.','Identify the estimand and appropriate JASP module with a specialist. These routes are outside this first version.'],sources:['jasp_features']},
  regression_dependence:{title:'Model the dependence as well as the predictors',summary:'A useful mean model can still have dependent residuals. Standard independent-error inference may then be misleading.',steps:['Retain timestamps and examine residual patterns across time.','Consider the time-series or repeated structure and how it affects estimation, uncertainty, and validation.','Use a design-specific model in JASP where available. A random train/test split of correlated observations can make prediction performance look too good.'],goals:['model'],sources:['nist_residuals']},
  causality:{title:'Plan evidence for the effect of changing a setting',summary:'An association in observational data is not, by itself, evidence that intervening on a setting will improve the response.',steps:['Identify controllable factors, plausible confounders, the experimental unit, and the improvement that matters.','Use a feasible randomised experiment when appropriate, with replication and blocks for known nuisance variation.','If experimentation is not possible, make the assumptions behind a causal interpretation explicit and seek a suitable analysis plan.'],goals:['doe'],analyses:['linear_regression','logistic_regression'],sources:['qc_doe']}
};
const REFERENCES = {
  qc_menu:{title:'JASP Quality Control: released menu definitions',url:'https://github.com/jasp-stats/jaspQualityControl/blob/v0.96.0/inst/Description.qml'},
  qc_capability:{title:'JASP: Process Capability Study interface',url:'https://github.com/jasp-stats/jaspQualityControl/blob/v0.96.0/inst/qml/processCapabilityStudies.qml'},
  qc_nested:{title:'JASP: non-replicable Gauge R&R help',url:'https://github.com/jasp-stats/jaspQualityControl/blob/v0.96.0/inst/help/msaGaugeRRnonrep.md'},
  qc_doe:{title:'JASP: design-of-experiments module source',url:'https://github.com/jasp-stats/jaspQualityControl/tree/v0.96.0/inst'},
  nist_charts:{title:'NIST/SEMATECH: variables control charts',url:'https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc32.htm'},
  nist_attributes:{title:'NIST/SEMATECH: attributes control charts',url:'https://www.itl.nist.gov/div898/handbook/pmc/section3/pmc33.htm'},
  nist_capability:{title:'NIST/SEMATECH: process capability',url:'https://www.itl.nist.gov/div898/handbook/pmc/section1/pmc16.htm'},
  nist_stability:{title:'NIST/SEMATECH: assessing process stability',url:'https://www.itl.nist.gov/div898/handbook/ppc/section4/ppc45.htm'},
  nist_residuals:{title:'NIST/SEMATECH: graphical model assessment',url:'https://www.itl.nist.gov/div898/handbook/pri/section2/pri24.htm'},
  destructive:{title:'Destructive measurement studies: crossed versus nested structures',url:'https://support.minitab.com/en-us/minitab/help-and-how-to/quality-and-process-improvement/measurement-system-analysis/supporting-topics/gage-r-r-and-wheeler-s-emp-studies/gage-studies-with-destructive-testing/'},
  jasp_features:{title:'JASP: official analysis inventory',url:'https://jasp-stats.org/features/'},
  jasp_equivalence:{title:'JASP: frequentist and Bayesian equivalence testing',url:'https://jasp-stats.org/2020/06/02/frequentist-and-bayesian-equivalence-testing-in-jasp/'},
  jasp_frequencies:{title:'JASP Frequencies: module source and supported analyses',url:'https://github.com/jasp-stats/jaspFrequencies'},
  release:{title:'JASP: official release notes',url:'https://jasp-stats.org/release-notes/'},
  modules:{title:'JASP: online module library',url:'https://module-library.jasp-stats.org/'}
};
const SCENARIOS = {
  filling:{title:'Has the filling line shifted?',family:'monitor',description:'One bottle is sampled at each time point. There is no natural subgroup. Explore a series with an introduced change after observation 40.',lesson:'Individual observations need a chart that preserves their sequence.',sample:'individuals',goal:'monitor',picks:['continuous','ordered','individual','general'],result:'imr'},
  rejects:{title:'Different batch sizes, different uncertainty',family:'monitor',description:'Inspectors record rejected units from samples of 60–160 items. Every item contributes one pass/fail classification.',lesson:'A changing number inspected points to a p chart.',sample:'passfail_varying',goal:'monitor',picks:['passfail','ordered','varying'],result:'p_chart'},
  spread:{title:'On target, but too much variation',family:'capability',description:'The filling process is centred near 500 mL. Specifications are 490–510 mL. The synthetic process is stable but its variation is deliberately large.',lesson:'A well-centred mean does not guarantee acceptable output.',sample:'cap_spread',goal:'capability',picks:['continuous','two','checked','normal'],result:'cap_normal'},
  centering:{title:'Precise, but too close to the upper limit',family:'capability',description:'Use the same 490–510 mL specifications. This synthetic process has much less variation, but its mean is near 507 mL.',lesson:'Contrast spread and centring using the same specifications.',sample:'cap_offcenter',goal:'capability',picks:['continuous','two','checked','normal'],result:'cap_normal'},
  operators:{title:'Three operators, the same ten parts',family:'measurement',description:'Each of three operators measures each of ten parts twice. You want to separate part variation from repeatability and reproducibility.',lesson:'Shared parts and repeated readings form a crossed Gauge R&R design.',sample:'gage',goal:'measurement',picks:['continuous','rr','crossed','yes'],result:'gage_crossed'},
  beforeafter:{title:'Did the adjustment reduce cycle time?',family:'compare',description:'The same 30 tasks are timed before and after an adjustment. Each row records a genuine pair.',lesson:'The paired differences are the unit of analysis.',sample:'compare_paired',goal:'compare',picks:['continuous','difference','paired'],result:'paired_t'},
  supplier:{title:'Is the new supplier close enough?',family:'compare',description:'Compare shaft measurements from two independent suppliers. For illustration, acceptable mean differences are prespecified as −0.05 to +0.05 mm.',lesson:'“Close enough” requires equivalence bounds, not a nonsignificant difference test.',sample:'compare_ind',goal:'compare',picks:['continuous','equivalent','ind'],result:'eq_ind'},
  factorial:{title:'Which settings affect strength?',family:'doe',description:'A randomised 2³ factorial experiment varies temperature, pressure, and speed. Each of the eight combinations is run independently twice.',lesson:'Keep the design structure and distinguish run replication from repeat readings.',sample:'factorial',goal:'doe',picks:['analyse','designed'],result:'doe_analyze'},
  response:{title:'Explore curvature in yield',family:'doe',description:'A face-centred central composite experiment varies temperature and reaction time, including five independent centre runs.',lesson:'A response surface can represent curvature; confirm proposed settings in new runs.',sample:'surface',goal:'doe',picks:['plan','optimise','continuous'],result:'doe_surface'},
  drivers:{title:'What is associated with process yield?',family:'model',description:'Seventy-two observations record yield, temperature, and pressure. Explore adjusted relationships in an illustrative independent-run dataset.',lesson:'A predictive relationship is not automatically a causal effect.',sample:'drivers',goal:'model',picks:['continuous','ind','association'],result:'linear_regression'}
};
function walk(goal,picks) {
  if (!GOALS[goal]) return null;
  let current=GOALS[goal].start;
  const history=[];
  for (const value of picks || []) {
    const q=NODES[current];
    if (!q) break;
    const item=q.options.find(o=>o.value===value);
    if (!item) break;
    history.push({id:current,value:item.value,label:item.label,short:q.short});
    current=typeof item.next==='function'?item.next(history):item.next;
    if (history.length>20) throw new Error('Invalid decision path');
  }
  return {goal,current,history};
}
