/* Version 0.2: retain the reviewed baseline and extend its practitioner routes. */
Object.assign(GOALS.compare, {family:'Tests, rates & variation',description:'Compare means, proportions, variances, or event rates; assess equivalence.'});
Object.assign(GOALS.model, {family:'Correlation & regression',description:'Explore associations or model an outcome using process measurements.'});
Object.assign(GOALS, {
  survival:{title:'Understand product lifetimes',family:'Survival & reliability',short:'Lifetimes',icon:'lifetime',description:'Study time to failure, censoring, accelerated tests, and recurrent events.',start:'s_event'},
  acceptance:{title:'Decide how to inspect a lot',family:'Acceptance sampling',short:'Acceptance',icon:'inspection',description:'Design or assess a sampling plan and make informed lot decisions.',start:'a_task'}
});

// Preserve existing mean-comparison values and URLs while widening the goal.
NODES.h_outcome.options.splice(3,0,option('count','An event or defect count with exposure','For example: breakdowns per operating hour, with repeated events possible.','h_rate_goal'));
NODES.h_outcome.options.find(o=>o.value==='other').label='Ordered ratings or another outcome';
NODES.h_outcome.help[2]='Event rates require counts and matching exposure. Ordered ratings and repeated or clustered outcomes need a suitable scale and design; numerical category codes do not automatically justify a mean test.';
NODES.h_goal.description='Choose whether your question concerns means, practical equivalence, or variation.';
NODES.h_goal.options.push(option('variation','Assess a variance or compare process spread','For example: is one line more variable than another?','h_variance_groups'));
NODES.h_binary.options.find(o=>o.value==='groups').next='h_proportion_groups';

NODES.r_outcome=question('What relationship would you like to understand?','Choose a symmetric association, a response model, or a question with a specialised outcome.','Relationship goal',[
  'Correlation describes an association between paired measurements without designating one as the response. Regression models a specified response using predictors.',
  'Correlation is not measurement agreement. Two instruments can be highly correlated and still disagree systematically.',
  'Counts need their exposure; lifetime data need failure status and censoring times. These have dedicated routes below.'
],[
  option('correlation','Explore correlations between measurements','For example: are surface roughness and bond strength related?','corr_structure'),
  option('continuous','Model a continuous response','For example: predict yield from temperature and pressure.','r_structure'),
  option('binary','Model a pass/fail response','For example: estimate defect probability from process settings.','r_structure'),
  option('count','Compare event rates or model counts','For example: failures per 1,000 operating hours.','h_rate_goal'),
  option('censored','Analyse time to failure','Include units still running at the end of observation.','s_event'),
  option('other','Another response or a specialised nonlinear model','The response or physical model needs a different specification.','g:special_model')
]);

Object.assign(NODES, {
  corr_structure:question('How were the paired measurements collected?','Pair variables within each item, and examine independence between items.','Correlation design',[
    'One roughness and one strength measurement on each of 80 separately sampled parts gives 80 pairs.',
    'Repeated readings on the same part, clustered batches, or dense sensor observations must not be counted as independent pairs.',
    'If you want to know whether instruments or raters agree, choose the measurement-system question.'
  ],[
    option('ind','One pair per independently sampled item','The pairs come from different, independent sampling units.','corr_purpose'),
    option('repeated','Repeated or clustered pairs','Several observations come from the same item or batch.','g:dependence'),
    option('time','Strong dependence through time','For example: two densely sampled sensor streams.','g:regression_dependence'),
    option('agreement','I want to assess measurement agreement','The question is whether instruments or inspectors give comparable readings.','g:correlation_agreement')
  ]),
  corr_purpose:question('Do you want to adjust for another measured variable?','Start with the association you intend to describe.','Adjustment',[
    'An unadjusted correlation describes the observed pair directly.',
    'Partial Pearson correlation linearly adjusts each of two numerical measurements for the specified continuous covariates.',
    'Adjustment choices need substantive justification; a partial correlation is not automatically a causal effect.'
  ],[
    option('unadjusted','Describe the pair directly','Explore the association without additional adjustment.','corr_scale'),
    option('partial','Adjust for measured continuous covariates','For example: relate roughness and strength after allowing for coating thickness.','corr_adjustment')
  ]),
  corr_scale:question('What kind of association matches the measurements?','Use the scatter plot and the measurement scale together.','Association type',[
    'Pearson correlation summarizes linear association between numerical measurements.',
    'Spearman and Kendall use ordering and can describe a curved monotonic association. Their values have different interpretations.',
    'A U-shaped or mixed-population pattern may not be summarized usefully by either kind of coefficient.'
  ],[
    option('linear','Continuous measurements with a roughly linear pattern','Pearson correlation is a useful starting description.','r:correlation_pearson'),
    option('rank','Ordered measurements or a monotonic rank relationship','For example: a 1–5 severity score compared with roughness.','r:correlation_rank'),
    option('curved','A nonmonotonic, mixed, or unclear pattern','I need to inspect the pattern before reducing it to one coefficient.','g:correlation_shape')
  ]),
  corr_adjustment:question('Is a linear adjustment for continuous covariates appropriate?','This route is for partial Pearson correlation with a defensible adjustment set.','Adjustment structure',[
    'Both measurements and the adjustment variables should have meaningful numerical scales.',
    'Nominal groups need suitable coding and a model that represents them; arbitrary group numbers should not be treated as continuous measurements.',
    'If an adjustment variable is a consequence of the measurements or a collider, controlling it can introduce bias.'
  ],[
    option('linear','Yes — numerical variables and a justified linear adjustment','I will examine the adjusted residual pattern.','r:correlation_partial'),
    option('complex','Factors, interactions, nonlinear adjustments, or uncertainty','The adjustment model needs a more explicit specification.','g:correlation_adjustment')
  ]),
  h_proportion_groups:question('How many independent groups are being compared?','Each group needs the number nonconforming and the number inspected, or individual binary observations.','Number of proportions',[
    'Two proportions can compare suppliers using independent pass/fail inspections.',
    'More than two groups require a joint assessment and a deliberate plan for follow-up comparisons.',
    'A count of nonconforming items cannot exceed the number inspected. Multiple defects on an item are a different outcome.'
  ],[
    option('two','Two independent groups','For example: current and proposed supplier.','r:proportion_two'),
    option('many','More than two independent groups','For example: four independent suppliers.','r:proportion_multiple')
  ]),
  h_variance_groups:question('Which variation question do you have?','A comparison of spread is different from a comparison of means.','Variance question',[
    'A one-variance test compares population variance with a specified reference variance; square a reference standard deviation before entering a variance.',
    'Two or more independent groups can be compared using a multiple-variances analysis.',
    'Gauge R&R concerns measurement-system variance components and has a separate route.'
  ],[
    option('one','One population variance versus a reference','For example: compare diameter variance with 0.01 mm².','h_variance_normal'),
    option('two','The spread of two independent processes','For example: compare two production lines.','h_variance_structure'),
    option('many','The spread of more than two processes','For example: compare three machines.','h_variance_structure'),
    option('components','Separate part, operator, and instrument variation','I need a measurement-system study.','g:variance_components')
  ]),
  h_variance_normal:question('Is an independent normal-population model defensible?','JASP’s One Variance hypothesis test uses the normal-theory chi-square distribution.','One-variance assumptions',[
    'The exact one-variance test is sensitive to departures from normality. Use process knowledge and plots, not just a normality-test threshold.',
    'Choosing a robust or bootstrap interval in this analysis does not change its chi-square hypothesis test.',
    'A time series with unresolved shifts or dependence is not an independent sample from one stable population.'
  ],[
    option('plausible','Yes — a normal model and independence are plausible','I have assessed the sampling process and distribution.','r:variance_one'),
    option('uncertain','No, or I have not assessed this yet','The hypothesis test needs a different justification or method.','g:variance_assumptions')
  ]),
  h_variance_structure:question('Do you have independent observations within and between groups?','The raw-data route can use median-centred Levene/Brown–Forsythe; summary-only input has different requirements.','Spread comparison design',[
    'Separate groups contain different sampling units. Similar sample sizes do not create independence.',
    'The raw-data Multiple Variances analysis provides median-centred Levene and Bonett options. F/Bartlett inference relies on normal-population assumptions.',
    'Summary variances alone cannot reconstruct the raw deviations required by Levene’s test.'
  ],[
    option('raw','Independent groups with individual measurements','Use raw-data spread comparisons and inspect each group’s distribution.',h=>answerMap(h).h_variance_groups==='two'?'r:variance_two':'r:variance_multiple'),
    option('summary','Independent normal groups, with summary data only','Sample sizes and variances are available; normal-theory inference is defensible.',h=>answerMap(h).h_variance_groups==='two'?'r:variance_two':'r:variance_multiple'),
    option('dependent','Paired, repeated, or clustered observations','The standard independent-group variance comparison is not sufficient.','g:dependence'),
    option('uncertain','Only summaries, without a justified normal model','I need raw observations or another defensible inference method.','g:variance_assumptions')
  ]),
  h_rate_goal:question('What do you want to learn about the event rate?','A rate is an event count divided by its matching exposure, such as operating hours.','Rate question',[
    'An item or system may have more than one event. This differs from a pass/fail proportion, where each inspected item is classified once.',
    'Classical Tests provides One Rate and Two Rates. Models involving several predictors need additional count-model decisions.',
    'Keep the exposure units consistent and distinguish a comparison of overall rates from a trend over time.'
  ],[
    option('one','Compare one rate with a reference','For example: breakdowns per operating hour against an agreed target.','h_rate_sampling'),
    option('two','Compare two independent rates','For example: events per operating hour in two processes.','h_rate_sampling'),
    option('model','Several groups, predictors, or a changing rate','I need a count model, rather than a one- or two-rate comparison.','g:count_model')
  ]),
  h_rate_sampling:question('Are the exposure and Poisson sampling assumptions defensible?','The basic rate tests need complete counts and matching exposure for independent, comparable observations.','Rate inputs and model',[
    'For example, 24 breakdowns over 800 operating hours is a rate of 0.03 per hour. The numerator and denominator must cover the same observation window.',
    'Poisson inference assumes suitable independent event occurrence and stable rates within the defined populations. Clustering, excess zeros, or overdispersion can need another model.',
    'Do not discard rows with missing counts while retaining their exposure, or vice versa. Resolve matched missingness before summing.'
  ],[
    option('ready','Yes — matched exposure and a plausible Poisson model','The rate units and independent populations are clearly defined.',h=>answerMap(h).h_rate_goal==='one'?'r:poisson_one':'r:poisson_two'),
    option('missing','The exposure or matching is incomplete','I currently have counts without a reliable denominator.','g:rate_exposure'),
    option('violated','Clustering, changing rates, or extra variation is present','The simple Poisson rate inference needs further assessment.','g:rate_model')
  ]),

  s_event:question('What does a failure record represent?','Choose the observation unit before choosing a lifetime model.','Failure process',[
    'For time to first failure, each independent unit contributes its failure time or its last observed running time.',
    'A repaired system can fail repeatedly. Its accumulated observation time and recurrent events describe a different process.',
    'Competing failure causes, dependent components, or complex entry and follow-up designs need a more specific model.'
  ],[
    option('first','Time to first failure of independent units','For example: time until a new bearing first fails.','s_censor'),
    option('recurrent','Repeated events on a repairable system','For example: breakdown counts during successive operating intervals.','s_recurrent_available'),
    option('complex','Competing risks, dependent units, or another design','The study has a structure beyond independent first-event times.','g:survival_design')
  ]),
  s_censor:question('How are incomplete lifetimes recorded?','A unit that is still working at the end of observation has not failed at that time.','Censoring and entry',[
    'Right censoring records that failure occurs later than the observed follow-up time. Keep both the time and the event indicator.',
    'Interval censoring records that failure occurred between two inspections; left censoring records that it occurred before a known time.',
    'Delayed entry means observation begins after time zero. Start–stop inputs can represent it, but the risk-set design must be specified correctly.'
  ],[
    option('right','Exact failures and/or right-censored lifetimes','I know failure times and when still-running units were last observed.','s_goal'),
    option('interval','Some failures are left- or interval-censored','I know a boundary or an inspection interval, rather than an exact time.','r:survival_parametric'),
    option('entry','Delayed entry or time-varying start–stop records','I need to define entry times and risk sets correctly.','g:survival_entry'),
    option('unknown','Failure status or follow-up boundaries are unclear','I need to reconstruct the observation records.','g:survival_censoring')
  ]),
  s_goal:question('What would you like to learn from the lifetimes?','Start with a survival curve, a predictor model, or a distribution suited to the engineering question.','Lifetime question',[
    'Kaplan–Meier describes survival without choosing a full lifetime distribution. Cox regression relates predictors to the hazard under a proportional-hazards model.',
    'Parametric models can estimate lifetime percentiles and reliability under an assumed distribution. Tail extrapolation requires particular care.',
    'Accelerated-life and mixture routes use newer module controls and ask you to confirm their availability.'
  ],[
    option('curve','Describe or compare survival curves','Estimate the fraction surviving over time; compare independent groups.','r:survival_km'),
    option('cox','Relate predictors to the failure hazard','Use Cox regression, with proportional hazards checked.','r:survival_cox'),
    option('distribution','Fit a lifetime distribution or estimate B10 life','For example: fit Weibull lifetimes and estimate the 10th failure percentile.','r:survival_parametric'),
    option('accelerated','Model a constant-stress accelerated life test','Use a physically justified temperature–lifetime relationship.','s_accel_design'),
    option('mixture','Investigate a mixture of lifetime populations','Fit latent lifetime components, with an identifiable model.','s_mixture_available')
  ]),
  s_accel_design:question('Is each unit tested at a fixed temperature?','The example route is for a constant-stress study with a defensible acceleration model.','Accelerated-test design',[
    'Assign several independent units to each temperature and keep the temperature fixed during each unit’s follow-up.',
    'Arrhenius or Eyring transformations need an engineering rationale, appropriate units, and a consistent failure mechanism.',
    'Step-stress tests and time-changing stresses require exposure-history modelling; treating their final stress as constant would be misleading.'
  ],[
    option('constant','Yes — fixed temperature within each unit','I can justify the stress–lifetime relationship and target use condition.','s_accel_available'),
    option('changing','Stress changes during a unit’s test, or the model is unclear','The exposure history or acceleration relationship needs review.','g:accelerated_design')
  ]),
  s_accel_available:question('Does your Survival module show the advanced temperature controls?','This guide uses the recent Parametric interface, including Advanced specification and Arrhenius/Eyring options.','Installed Survival options',[
    'The recent official 0.98.2 beta includes these options. Older stable module installations can have the basic Parametric analysis without these controls.',
    'Check the actual installed interface. The guide can explain the analysis, but cannot change or inspect your JASP installation.'
  ],[
    option('available','Yes — these controls are visible','I can follow the current advanced setup.','r:survival_accelerated'),
    option('missing','No, or I have not checked','I need to verify the installed module version first.','g:survival_beta')
  ]),
  s_mixture_available:question('Does your Survival menu include Parametric Mixture?','Finite-mixture lifetime analysis is part of the recent module expansion.','Installed mixture option',[
    'The current guide was checked against the official 0.98.2 beta source and build.',
    'The basic Parametric menu in an older stable installation does not imply that Parametric Mixture is also available.'
  ],[
    option('available','Yes — Parametric Mixture is available','I can fit and diagnose candidate lifetime components.','r:survival_mixture'),
    option('missing','No, or I have not checked','I need to verify the installed module first.','g:survival_beta')
  ]),
  s_recurrent_available:question('Does your Survival menu include Recurrent Events?','This recent analysis models event counts over successive observation intervals.','Installed recurrent option',[
    'The current guide was checked against the official 0.98.2 beta source and build.',
    'The documented implementation has a positive-count restriction. The next question checks whether your records meet it without discarding observation time.'
  ],[
    option('available','Yes — Recurrent Events is visible','I can check whether my interval-count data fit its current input contract.','s_recurrent_data'),
    option('missing','No, or I have not checked','I need to verify the installed module first.','g:survival_beta')
  ]),
  s_recurrent_data:question('Do all complete observation intervals have a positive event count?','Keep every interval of observed exposure, including intervals with no failure.','Recurrent-event inputs',[
    'The verified implementation requires at least three complete intervals per analysed system or group, strictly increasing interval end times, and positive integer event counts in each interval.',
    'Real zero-event intervals contain information about exposure. Dropping them changes the analysis and is not a valid workaround.',
    'The current maximum-likelihood calculation uses an interval-count likelihood; it should not be described as an exact-event-time likelihood.'
  ],[
    option('positive','Yes — at least three complete intervals per system','Every interval has a positive count; each system history is coherent and chronological.','r:survival_recurrent'),
    option('zeros','Some observed intervals have zero events','I must preserve those intervals and their exposure.','g:recurrent_zeros'),
    option('other','Too few intervals, exact event times, or other records','Fewer than three complete intervals per system, pooled systems, or incomplete exposure need review.','g:recurrent_format')
  ]),

  a_task:question('What do you need to do with an acceptance-sampling plan?','Separate choosing a rule, studying its risks, and applying an agreed rule to a lot.','Sampling purpose',[
    'A plan specifies the sample size and the acceptance rule before inspection.',
    'The operating-characteristic curve shows how often the rule accepts lots at different quality levels. It does not certify that every accepted item conforms.',
    'Bayesian routes describe lot evidence using explicit prior assumptions and newer module options.'
  ],[
    option('design','Design a sampling plan','Choose an inspection rule from agreed quality levels and risks.','a_measure'),
    option('evaluate','Evaluate an existing plan','Examine acceptance probabilities, risks, and inspection effort.','a_measure'),
    option('decide','Use inspection results to decide on a lot','The plan should already be agreed before the sample is examined.','a_decision_type'),
    option('bayesian','Use Bayesian evidence about lot quality','Consider one lot or a sequence of lots, with explicit prior assumptions.','a_bayes_scope')
  ]),
  a_measure:question('What does the inspection record?','The quality characteristic determines the plan family.','Inspection type',[
    'Attribute sampling classifies each inspected item once, such as conforming or nonconforming.',
    'Variable sampling uses a continuous measurement and specification limits, usually under a normal model.',
    'A count of multiple defects per item needs a deliberate defect and exposure definition; it is not automatically a pass/fail count.'
  ],[
    option('attribute','Pass/fail classification of individual items','Each inspected item is counted as conforming or nonconforming.',h=>answerMap(h).a_task==='design'?'a_plan_agreement':'r:accept_analyze_attribute'),
    option('variable','A continuous measurement with specification limits','For example: a shaft diameter with an engineering limit.','a_variable_assumptions'),
    option('defects','Multiple defects or another count definition','The inspection model needs a specific interpretation.','g:acceptance_count_definition')
  ]),
  a_plan_agreement:question('Are the quality levels and decision risks agreed?','A plan design needs an acceptable quality level, a rejectable quality level, and producer’s and consumer’s risks.','Plan agreement',[
    'AQL and RQL/LTPD are reference quality levels, with AQL lower than RQL. They are not observed sample percentages.',
    'Producer’s risk is the chance of rejecting at AQL; consumer’s risk is the chance of accepting at RQL.',
    'Choose these quantities from the inspection agreement and the consequences of errors before seeing the lot sample.'
  ],[
    option('agreed','Yes — the reference quality and risks are specified','I can enter the lot size and the agreed design inputs.',h=>answerMap(h).a_measure==='attribute'?'r:accept_create_attribute':'r:accept_create_variable'),
    option('missing','Not yet — I only know a preferred sample size or target','I need to define the decision agreement.','g:acceptance_agreement')
  ]),
  a_variable_assumptions:question('Are the measurement model and specification limits defensible?','Variable sampling needs a meaningful numerical characteristic and the assumptions of the selected rule.','Variable-plan assumptions',[
    'Use genuine engineering specification limits, a representative random sample, and an appropriate normal-population model.',
    'Distinguish a known historical population standard deviation from the standard deviation estimated from the current sample.',
    'One-sided and two-sided criteria, and known- versus unknown-variance criteria, differ; use the settings for the agreed plan.'
  ],[
    option('ready','Yes — limits, sampling, and a normal model are justified','I know whether the plan assumes a known or unknown standard deviation.',h=>{
      const a=answerMap(h);return a.a_task==='design'?'a_plan_agreement':a.a_task==='evaluate'?'r:accept_analyze_variable':'r:accept_decide_variable';
    }),
    option('uncertain','No, or the distribution/limits are uncertain','I need to examine these requirements before using a variable rule.','g:acceptance_variable_assumptions')
  ]),
  a_decision_type:question('Which agreed inspection rule are you applying?','A lot decision should follow a rule chosen before observing the sample.','Lot decision rule',[
    'For an attribute plan, compare observed nonconforming counts with the agreed acceptance/rejection thresholds, including any stages.',
    'JASP’s Accept/Reject Lots screen is a variable-sampling analysis using numerical measurements or their summaries.',
    'If the plan has not been agreed, establish it before using current inspection results to justify a preferred decision.'
  ],[
    option('variable','A variable plan using measured values','For example: the agreed k-method rule for shaft diameters.','a_variable_assumptions'),
    option('attribute','An attribute plan using nonconforming counts','Apply the agreed n/c/r rule to the inspection results.','g:attribute_lot_decision'),
    option('none','No inspection rule has been agreed','I need to establish the decision rule first.','g:acceptance_agreement')
  ]),
  a_bayes_scope:question('Are you assessing one lot or a chronological sequence?','The two Bayesian routes have different inputs and assumptions.','Bayesian sampling scope',[
    'Single-lot Bayesian Sampling uses observed counts and explicit prior assumptions about the lot’s nonconformance.',
    'Bayesian State-Space Sampling models a chronological sequence and allows lot quality to evolve.',
    'Posterior probabilities answer a different question from the repeated-sampling risks on an OC curve.'
  ],[
    option('single','One lot with an observed inspection sample','Enter lot size, sample size, and nonconforming count.','a_bayes_available'),
    option('sequence','A chronological sequence of inspected lots','Retain each lot’s counts, sample size, total size, and order.','a_bayes_available')
  ]),
  a_bayes_available:question('Does your module show the required Bayesian analysis?','These routes use beta additions to Acceptance Sampling; confirm the menu in your installed module.','Installed sampling options',[
    'For one lot, look for Bayesian Sampling. For a sequence, look for Bayesian State-Space Sampling.',
    'The official 0.96.4 beta builds include these additions. A stable installation with the five classical plan tools may not show them.'
  ],[
    option('available','Yes — the relevant Bayesian analysis is visible','I can check the count inputs and prior assumptions.','a_bayes_inputs'),
    option('missing','No, or I have not checked','I need to verify the installed module before following this setup.','g:acceptance_beta')
  ]),
  a_bayes_inputs:question('Are the counts, lot sizes, and prior assumptions available?','Bayesian inference still needs a defined sampling process and coherent inputs.','Bayesian inputs',[
    'Nonconforming count must be between zero and the inspected sample size; the inspected sample cannot exceed the total lot size.',
    'Use random representative sampling, an explicit definition of nonconformance, and a justified prior.',
    'For a sequence, preserve chronological order and assess whether a state-space model is suitable for how quality evolves.'
  ],[
    option('ready','Yes — the inputs and assumptions can be specified','I will examine prior sensitivity and the reported decision quantities.',h=>answerMap(h).a_bayes_scope==='single'?'r:accept_bayesian_single':'r:accept_bayesian_sequence'),
    option('missing','Some inputs or assumptions are unresolved','I need to complete the lot records or specify the prior model.','g:acceptance_bayes_inputs')
  ])
});

Object.assign(REFERENCES, {
  correlation:{title:'JASP Regression: released Correlation controls',url:'https://github.com/jasp-stats/jaspRegression/blob/v0.96.0/inst/qml/Correlation.qml'},
  classical:{title:'Classical Tests: released menu and analyses',url:'https://github.com/jasp-stats-modules/jaspClassicalTests/blob/9f1c72655a3304843e7000ef7b0fdeae80c01591/inst/Description.qml'},
  survival:{title:'Survival: released interface source',url:'https://github.com/jasp-stats/jaspSurvival/tree/69dc1db1b65e48c3068287fa8e365a1324b12fe7/inst'},
  survival_beta:{title:'Survival 0.98.2 beta: official builds',url:'https://github.com/jasp-stats-modules/jaspSurvival/releases/tag/0.98.2-beta.0_R-4-5-2_Beta'},
  survival_current:{title:'Survival: current verified interfaces',url:'https://github.com/jasp-stats/jaspSurvival/tree/d3550d881f302762b35050a4c86e037378ab9179/inst'},
  acceptance:{title:'Acceptance Sampling: released interface source',url:'https://github.com/jasp-stats/jaspAcceptanceSampling/tree/v0.96.0/inst'},
  acceptance_beta:{title:'Acceptance Sampling: beta analysis interfaces',url:'https://github.com/jasp-stats/jaspAcceptanceSampling/tree/178f3c82937d3632110f6761a642d0de1a169cd2/inst'},
  module_catalogue:{title:'Official module catalogue; checked 29 October 2026',url:'https://module-library.jasp-stats.org/index.json'}
});

Object.assign(GUARDS, {
  correlation_agreement:{title:'Assess measurement agreement directly',summary:'A strong correlation can coexist with a systematic bias or large disagreement between instruments or inspectors.',steps:['Define the required agreement: repeatability, reproducibility, bias across a range, or agreement on categories.','Keep part, operator, instrument, and repeated-reading identifiers.','Use the measurement-system route to choose a design and an appropriate analysis.'],goals:['measurement'],analyses:['attribute_agreement','gage_crossed','gage_linearity'],sources:['correlation','qc_menu']},
  correlation_shape:{title:'Inspect the relationship before choosing one coefficient',summary:'A curved, mixed, or unclear pattern may be poorly summarized by one Pearson or rank correlation.',steps:['Open Regression → Classical → Correlation and examine Scatter plots for the variables; interpret the plots before the coefficient.','Check for distinct product types, outliers, a U-shaped pattern, and dependence. Do not select a coefficient by whichever gives the preferred p-value.','If the scientific question has a response and predictors, consider a suitably specified regression model.'],analyses:['correlation_pearson','correlation_rank','linear_regression'],sources:['correlation']},
  correlation_adjustment:{title:'Specify the adjustment model',summary:'The partial-correlation example assumes a meaningful linear adjustment for continuous covariates.',steps:['Define why each adjustment variable belongs in the model and how it was measured.','Represent categorical groups, interactions, nonlinear terms, and dependence deliberately.','Use a regression model or a design-specific analysis when the simple partial-correlation setup does not represent the question.'],analyses:['linear_regression','correlation_partial'],sources:['correlation']},
  variance_components:{title:'Choose a variance-component study',summary:'Separating instrument, operator, and part variation is a measurement-system design question.',steps:['Identify the sources of variation and which units each operator measures.','Plan replication that separates repeatability from other sources.','Use the measurement-system route for crossed or nested Gauge R&R, or a design-specific variance-component model.'],goals:['measurement'],sources:['qc_menu']},
  variance_assumptions:{title:'Resolve the distribution and sampling assumptions',summary:'A normal-theory variance test needs a defensible independent normal-population model. Selecting a different interval does not automatically change the hypothesis test.',steps:['Inspect the sampling design, group distributions, outliers, mixtures, and time order.','For independent groups with raw observations, consider median-centred Levene/Brown–Forsythe in Multiple Variances and examine the group shapes.','For a single variance or summaries from nonnormal groups, obtain a method appropriate to the intended parameter; do not treat the ordinary chi-square or F reference as robust by default.'],analyses:['variance_one','variance_two','variance_multiple'],sources:['classical']},
  rate_exposure:{title:'Recover matched event counts and exposure',summary:'The rate comparison needs a consistent observation window and exposure unit for each count.',steps:['Retrieve operating time, inspected area, or the appropriate exposure for every count.','Resolve missing counts and exposures as matched records, then reconcile the totals.','Return to the rate route once the populations, exposure units, and count definition are clear.'],goals:['compare'],sources:['classical']},
  rate_model:{title:'Choose a model for the event process',summary:'Clustering, rate changes, or overdispersion can make a simple Poisson rate test misleading.',steps:['Preserve the chronological record, system IDs, event counts, and exposure.','Assess whether the question concerns independent population rates, a trend, covariate effects, or repeated events in a repairable system.','Use the relevant monitoring, lifetime, or count-model route with a justified sampling model.'],goals:['monitor','survival','model'],sources:['classical','survival_current']},
  survival_design:{title:'Specify the failure process and risk sets',summary:'Competing causes, dependent components, or complex event histories need a model that represents their structure.',steps:['Define the event of interest, independent unit, failure causes, follow-up period, and what removes an item from observation.','Retain cause codes, system IDs, entry times, and all relevant censoring information.','Review an appropriate survival or recurrent-event model in the installed module; the simple first-event route does not automatically resolve these designs.'],goals:['survival'],sources:['survival','survival_current']},
  survival_entry:{title:'Define a valid start–stop survival design',summary:'JASP’s Cox and Parametric interfaces support Counting inputs, but delayed entry and time-changing records require a correctly specified risk-set model.',steps:['Distinguish one delayed-entry record per unit from multiple records carrying time-varying covariates or recurrent events.','Record each entry/start time, end time, unit ID where needed, and correctly coded event status.','Confirm the supported start–stop model and its dependence assumptions in the installed analysis before assigning these columns. Do not reset entry times to zero or treat repeated rows as independent units.'],analyses:['survival_cox','survival_parametric'],sources:['survival']},
  survival_censoring:{title:'Reconstruct the lifetime observation records',summary:'Failure status and follow-up boundaries are essential parts of a lifetime observation.',steps:['For each unit, recover its start/entry time, failure time if observed, and last known running time.','For periodic inspections, retain both bounds of an interval containing the failure.','Code exact, right-, left-, or interval-censored records correctly; do not replace censored records with failures or discard surviving units.'],goals:['survival'],sources:['survival']},
  accelerated_design:{title:'Specify the stress history and acceleration model',summary:'The included accelerated-life example assumes fixed temperature within each unit and a defensible temperature–lifetime relationship.',steps:['Record the full stress history and identify whether the failure mechanism remains comparable across test and use conditions.','For changing stress, select a cumulative-exposure or other model appropriate to that history before fitting.','Review the installed Survival options and an engineering model for the study; the final applied temperature alone is not a valid substitute for the full exposure history.'],analyses:['survival_accelerated'],sources:['survival_current']},
  survival_beta:{title:'Check the installed Survival module',summary:'This route uses recent Survival controls available in official beta builds; an older stable installation may not expose them.',steps:['Check whether the required menu or controls are present: Parametric with Advanced specification and temperature transformations, Parametric Mixture, or Recurrent Events.','The guide’s advanced baseline is official Survival 0.98.2-beta.0, published 29 October 2026. Follow your organisation’s module-update policy if an update is needed.','Return to the route after checking availability. Basic Kaplan–Meier, Cox, and Parametric guides remain available for questions that match their assumptions.'],goals:['survival'],analyses:['survival_km','survival_cox','survival_parametric'],sources:['survival_beta','module_catalogue']},
  recurrent_zeros:{title:'Keep zero-event intervals in the observation history',summary:'The verified Recurrent Events implementation rejects zero-count intervals. Those intervals contain exposure information and must not be dropped to make the analysis run.',steps:['Preserve every observed interval and its duration, including zero-event intervals.','Check whether a newer installed build supports nonnegative counts; the current guide was verified against 0.98.2 beta.','Obtain a suitable supported model or a corrected module implementation before analysing these data. Do not add artificial events or selectively omit quiet periods.'],sources:['survival_current']},
  recurrent_format:{title:'Review the recurrent-event representation',summary:'The current example assumes a complete, chronological interval-count history for one coherent repairable-system process.',steps:['Keep the observation start, every interval boundary, event count, and system identifier.','Do not pool different systems or convert exact event times to arbitrary intervals without specifying the likelihood and exposure.','Check the installed Recurrent Events input contract and model for the actual system history.'],analyses:['survival_recurrent'],sources:['survival_current']},
  acceptance_agreement:{title:'Agree the lot decision before inspection',summary:'An acceptance rule needs stated quality reference levels and acceptable decision risks, or an already specified inspection standard.',steps:['Define the lot, random sampling procedure, nonconformance criterion, and consequences of accepting or rejecting.','For plan design, specify AQL, RQL/LTPD, producer’s risk, and consumer’s risk. A preferred sample size alone does not define the risks.','Agree the rule before observing the sample, then use the appropriate JASP plan-design or plan-evaluation analysis.'],goals:['acceptance'],analyses:['accept_create_attribute','accept_create_variable'],sources:['acceptance']},
  acceptance_count_definition:{title:'Define the defect count and inspection model',summary:'A count of defects can differ from a count of nonconforming items, especially when one item can have several flaws.',steps:['Define what one counted event means and the exposure represented by each sampled item.','The attribute-plan tools offer Binomial, Hypergeometric, and Poisson options. Choose a model whose quality parameters and exposure match the agreed inspection rule.','Review the plan’s assumptions and units before interpreting the generated n/c rule or its operating-characteristic curve.'],analyses:['accept_create_attribute','accept_analyze_attribute'],sources:['acceptance']},
  acceptance_variable_assumptions:{title:'Check the requirements for variable sampling',summary:'The selected k-method rule needs genuine specifications, representative sampling, and the distribution and standard-deviation assumptions of that plan.',steps:['Confirm the engineering lower/upper limits and whether the plan is one- or two-sided.','Assess the normal-population model and whether any historical standard deviation can defensibly be treated as known.','If a variable plan is unsuitable, consider a properly designed pass/fail plan or a specialist plan for the measurement distribution.'],analyses:['accept_create_variable','accept_create_attribute'],sources:['acceptance']},
  attribute_lot_decision:{title:'Apply the agreed attribute decision rule',summary:'The actual decision uses the plan’s observed-count rule. JASP’s Analyze Attribute Plan evaluates that rule’s operating characteristics; it does not import the observed pass/fail sample as a separate lot-decision analysis.',steps:['For a single-stage rule, inspect the agreed n items and count nonconforming items d. Accept when d ≤ c; reject when d ≥ r, with r = c + 1.','For staged inspection, compare cumulative nonconforming counts with the stage’s c/r thresholds; continue only in the specified continuation region.','Use Analyze Attribute Plan to review the rule’s OC curve and risks. Record the observed counts and the resulting lot decision under the original agreed rule.'],analyses:['accept_analyze_attribute'],sources:['acceptance']},
  acceptance_beta:{title:'Check the installed Bayesian sampling options',summary:'Bayesian Sampling and Bayesian State-Space Sampling are verified beta additions to the Acceptance Sampling module.',steps:['Look for the required analysis in the installed Acceptance Sampling menu.','The official catalogue lists 0.96.4 beta builds with these tools; the released five-analysis baseline does not include them.','Follow your organisation’s module-update policy if needed, then return to the Bayesian route.'],goals:['acceptance'],sources:['acceptance_beta','module_catalogue']},
  acceptance_bayes_inputs:{title:'Complete the lot records and prior specification',summary:'Bayesian lot inference needs coherent counts and a documented model for prior information and sampling.',steps:['Retrieve each lot’s total size, inspected sample size, and count of nonconforming items. Check 0 ≤ defects ≤ inspected ≤ lot size.','Define the quality threshold, prior model, and sensitivity checks. For a sequence, preserve lot order and justify how quality may evolve.','Return to the relevant Bayesian route when these inputs can be specified without reconstructing them from a desired decision.'],goals:['acceptance'],sources:['acceptance_beta']}
});

Object.assign(GUARDS.other_outcome, {summary:'Ordered ratings and specialised response scales need their own estimand and model.',steps:['For event counts with exposure, use the One Rate/Two Rates route under Compare processes, or choose a count model for predictors.','For ordered ratings, decide whether the target is an ordinal association, a distributional difference, or rater agreement.','JASP has additional rank and generalised models. This guide does not treat a rank test as an interchangeable test of means.'],goals:['compare','model','measurement'],sources:['classical','correlation','jasp_features']});
Object.assign(GUARDS.count_model, {steps:['Retain the count and matching exposure; exposure may enter a model as an offset.','Check dispersion, excess zeros, dependence, and the response definition before choosing a count-regression family.','For one or two independent population rates, Classical Tests has dedicated analyses. For covariates or more complex rate models, check the exact family and exposure support in the installed JASP model.'],analyses:['poisson_one','poisson_two'],goals:['compare','monitor'],sources:['classical','jasp_features']});
Object.assign(GUARDS.special_model, {summary:'Physical nonlinear relationships and specialised response structures require an explicit model and appropriate fitting method.',steps:['Write the scientific response model, parameter interpretation, measurement scale, and sampling design.','Confirm that the installed JASP analysis supports that model and likelihood. A generalised linear model is not a substitute for arbitrary nonlinear least squares.','For time-to-failure outcomes, use the dedicated lifetime route and preserve all censoring information.'],goals:['survival'],sources:['jasp_features','survival']});
GUARDS.attribute_capability.steps[2]='For a reference event rate, consider Classical Tests → Rates. Count/proportion estimates and acceptance-sampling risks answer different questions from continuous Cp/Cpk.';
GUARDS.attribute_capability.analyses.push('poisson_one');
GUARDS.attribute_capability.sources.push('classical');

Object.assign(SCENARIOS, {
  roughness:{title:'Are roughness and bond strength related?',family:'model',description:'Eighty independent synthetic components have roughness, strength, and coating measurements. Explore the unadjusted linear relationship.',lesson:'Correlation describes association; it does not establish agreement or a causal effect.',sample:'correlation_pairs',goal:'model',picks:['correlation','ind','unadjusted','linear'],result:'correlation_pearson'},
  visualscore:{title:'Rougher parts, worse visual ratings?',family:'model',description:'Seventy-two synthetic parts have roughness measurements and ordered 1–5 severity scores, including ties.',lesson:'A rank coefficient uses meaningful ordering without assuming equal spacing of the ratings.',sample:'correlation_ranks',goal:'model',picks:['correlation','ind','unadjusted','rank'],result:'correlation_rank'},
  variances:{title:'Which machine has more variation?',family:'compare',description:'Independent synthetic measurements from three machines illustrate a comparison of spread using the raw-data Multiple Variances analysis.',lesson:'Comparing variation is a different question from comparing means.',sample:'variance_groups',goal:'compare',picks:['continuous','variation','many','raw'],result:'variance_multiple'},
  breakdowns:{title:'Do the processes have different event rates?',family:'compare',description:'Synthetic records contain 24 events over 800 hours for process A and 42 over 600 hours for process B. Retain the different exposures.',lesson:'Compare events per exposure; the raw event counts alone do not answer the question.',sample:'poisson_pair',goal:'compare',picks:['count','two','ready'],result:'poisson_two'},
  lifetimes:{title:'What fraction of bearings is still running?',family:'survival',description:'Ninety-six synthetic units are followed to first failure or the end of observation; some are still running when follow-up ends.',lesson:'Right-censored lifetimes contribute follow-up information without being counted as failures.',sample:'survival_lifetimes',goal:'survival',picks:['first','right','curve'],result:'survival_km'},
  lifetimepercentile:{title:'Estimate the time by which 10% have failed',family:'survival',description:'A synthetic right-censored lifetime study illustrates fitting a Weibull distribution and estimating B10 life.',lesson:'B10 is the 10th failure percentile, corresponding to 90% survival; tail-model assumptions matter.',sample:'survival_weibull',goal:'survival',picks:['first','right','distribution'],result:'survival_parametric'},
  incoming:{title:'How many seals should we inspect?',family:'acceptance',description:'A synthetic planning exercise sets AQL to 1%, RQL to 6%, producer’s risk to 5%, and consumer’s risk to 10% for a lot of 1,000 seals.',lesson:'Choose the sampling rule from the quality agreement before collecting the inspection sample.',sample:null,goal:'acceptance',picks:['design','attribute','agreed'],result:'accept_create_attribute'},
  shaftlot:{title:'Apply a variable plan to a shaft lot',family:'acceptance',description:'Twenty-four synthetic diameter measurements illustrate an already agreed one-sided k-method plan with a known historical standard deviation.',lesson:'The specification, sampling rule, and standard-deviation assumption determine the lot decision.',sample:'acceptance_measurements',goal:'acceptance',picks:['decide','variable','ready'],result:'accept_decide_variable'}
});
