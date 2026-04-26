-- 0006_seed_topics.sql
-- Idempotent insert of the 32 JDN101 syllabus topics.
-- Source: src/data.jsx. Typos normalised per specs/design-corrections.md.

insert into topics (id, order_num, philosopher, theme) values
  ( 1,  1, 'David Hume',                          'Legal Positivism'),
  ( 2,  2, 'Jeremy Bentham',                      'On the Principles of Morals and Legislation'),
  ( 3,  3, 'John Austin',                         'The Province of Jurisprudence'),
  ( 4,  4, 'Hans Kelsen',                         'Pure Theory of Law'),
  ( 5,  5, 'Thomas Hobbes',                       'Legalism, or Rule by the Law'),
  ( 6,  6, 'Herbert Hart',                        'Rule of Recognition'),
  ( 7,  7, 'Confucianism',                        'Political Theory and Rectification of Names'),
  ( 8,  8, 'Ronald Dworkin',                      'Interpretivist Approach and Best Fit Theory'),
  ( 9,  9, 'Justice Oliver Wendell Holmes',       'The Path of the Law'),
  (10, 10, 'Roberto Mangabeira Unger',            'Hegemony, Deconstruction and Hermeneutics of Suspicion'),
  (11, 11, 'Friedrich Karl von Savigny',          'The Volksgeist'),
  (12, 12, 'Sir Henry Sumner Maine',              'Legal History Theory'),
  (13, 13, 'G.W.F. Hegel',                        'Dialectic Idealism and the Philosophy of Law'),
  (14, 14, 'William James',                       'Law as a Means to Satisfy Needs'),
  (15, 15, 'Emile Durkheim',                      'Theory of Legal Change'),
  (16, 16, 'Charles Louis Baron de Montesquieu',  'Adapting Law to Shifting Conditions'),
  (17, 17, 'R. Von Jhering',                      'Law as a Method of Ordering Society'),
  (18, 18, 'Roscoe Pound',                        'The Scope and Purpose of Sociological Jurisprudence'),
  (19, 19, 'Max Weber',                           'Typology of Law'),
  (20, 20, 'Roberto Mangabeira Unger',            'Cultural Context Theory'),
  (21, 21, 'Eugen Ehrlich',                       'The Living Law'),
  (22, 22, 'Talcott Parsons',                     'Law as Integrativist Mechanism of Social Control'),
  (23, 23, 'John Rawls',                          'The Sociological School'),
  (24, 24, 'Jeremy Bentham',                      'Felicific Calculus'),
  (25, 25, 'John Stuart Mill',                    'Utilitarianism, Law and Authority'),
  (26, 26, 'Henry Sidgwick',                      'Act and Rule Utilitarianism'),
  (27, 27, 'Richard Posner',                      'Economic Jurisprudence and Consequentialism'),
  (28, 28, 'Jeremy Bentham',                      'Originalism, Textualism, the Plain Meaning Approach'),
  (29, 29, 'Antonin Scalia',                      'Contemporary Originalism'),
  (30, 30, 'Harold Lasswell and Myres McDougal',  'Legal Education and Public Policy'),
  (31, 31, 'Philip Bobbitt',                      'The Six Main Modalities'),
  (32, 32, 'Bonum Commune',                       'The Aristotelian-Thomistic Tradition')
on conflict (id) do nothing;
