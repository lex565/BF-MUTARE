-- A logo, offered to every business and required of none.
--
-- WHY OPTIONAL, AND WHY THAT IS NOT A DETAIL. A woman selling bread from her
-- kitchen does not have a logo and is not going to commission one to sell
-- bread. Making it a condition of trading would exclude precisely the people
-- Musuwo exists for, while costing a registered company nothing. So it is
-- offered, it improves how they look in the directory, and nothing is withheld
-- from anybody who does not have one.
--
-- is_mandatory = false, so `readiness()` lists it on the checklist and never
-- counts it as missing. It appears with an "optional" label beside it.

INSERT INTO "provider_requirements"
  ("provider_type", "requirement", "label", "note", "is_mandatory", "sort_order")
VALUES
  ('INDIVIDUAL_SELLER', 'logo', 'A logo or a picture of what you sell',
   'Not required. It is what customers see first in the directory.', false, 200),
  ('INFORMAL_BUSINESS', 'logo', 'A logo or a picture of your business',
   'Not required. It is what customers see first in the directory.', false, 200),
  ('REGISTERED_BUSINESS', 'logo', 'Your logo',
   'Not required, but most registered businesses have one.', false, 200),
  ('SERVICE_PROVIDER', 'logo', 'A logo or a photo of your work',
   'Not required. A photo of finished work does the job just as well.', false, 200),
  ('ACCOMMODATION_PROVIDER', 'logo', 'A picture of the place',
   'Not required. The best outside photograph works well here.', false, 200)
ON CONFLICT DO NOTHING;
