
-- =============================================
-- SEED DATA: Level 1 + Level 2 Muscle Groups
-- =============================================

INSERT INTO muscle_groups 
    (name, slug, level, display_order, parent_id)
VALUES

-- ==================== LEVEL 1 ====================
('Chest', 'chest', 1, 10, NULL),
('Back', 'back', 1, 20, NULL),
('Shoulders', 'shoulders', 1, 30, NULL),
('Biceps', 'biceps', 1, 40, NULL),
('Triceps', 'triceps', 1, 50, NULL),
('Forearms', 'forearms', 1, 60, NULL),

('Core', 'core', 1, 70, NULL),
('Lower Back', 'lower-back', 1, 80, NULL),

('Glutes', 'glutes', 1, 90, NULL),
('Quadriceps', 'quadriceps', 1, 100, NULL),
('Hamstrings', 'hamstrings', 1, 110, NULL),
('Calves', 'calves', 1, 120, NULL),

('Hip Flexors', 'hip-flexors', 1, 130, NULL),
('Adductors', 'adductors', 1, 140, NULL),
('Abductors', 'abductors', 1, 150, NULL),

-- ==================== LEVEL 2 ====================

-- Chest Subdivisions
('Upper Chest', 'upper-chest', 2, 1, (SELECT id FROM muscle_groups WHERE slug = 'chest')),
('Lower Chest', 'lower-chest', 2, 2, (SELECT id FROM muscle_groups WHERE slug = 'chest')),

-- Back Subdivisions
('Lats', 'lats', 2, 1, (SELECT id FROM muscle_groups WHERE slug = 'back')),
('Upper Back / Traps', 'upper-back', 2, 2, (SELECT id FROM muscle_groups WHERE slug = 'back')),
('Rhomboids', 'rhomboids', 2, 3, (SELECT id FROM muscle_groups WHERE slug = 'back')),

-- Shoulders Subdivisions
('Anterior Deltoids', 'anterior-deltoids', 2, 1, (SELECT id FROM muscle_groups WHERE slug = 'shoulders')),
('Lateral Deltoids', 'lateral-deltoids', 2, 2, (SELECT id FROM muscle_groups WHERE slug = 'shoulders')),
('Rear Deltoids', 'rear-deltoids', 2, 3, (SELECT id FROM muscle_groups WHERE slug = 'shoulders')),

-- Core Subdivisions
('Rectus Abdominis', 'rectus-abdominis', 2, 1, (SELECT id FROM muscle_groups WHERE slug = 'core')),
('Obliques', 'obliques', 2, 2, (SELECT id FROM muscle_groups WHERE slug = 'core')),
('Transverse Abdominis', 'transverse-abdominis', 2, 3, (SELECT id FROM muscle_groups WHERE slug = 'core')),

-- Lower Back
('Erector Spinae', 'erector-spinae', 2, 1, (SELECT id FROM muscle_groups WHERE slug = 'lower-back')),

-- Quadriceps
('Rectus Femoris', 'rectus-femoris', 2, 1, (SELECT id FROM muscle_groups WHERE slug = 'quadriceps')),
('Vastus Lateralis', 'vastus-lateralis', 2, 2, (SELECT id FROM muscle_groups WHERE slug = 'quadriceps')),
('Vastus Medialis', 'vastus-medialis', 2, 3, (SELECT id FROM muscle_groups WHERE slug = 'quadriceps')),

-- Hamstrings
('Biceps Femoris', 'biceps-femoris', 2, 1, (SELECT id FROM muscle_groups WHERE slug = 'hamstrings')),
('Semitendinosus', 'semitendinosus', 2, 2, (SELECT id FROM muscle_groups WHERE slug = 'hamstrings')),
('Semimembranosus', 'semimembranosus', 2, 3, (SELECT id FROM muscle_groups WHERE slug = 'hamstrings')),

-- Calves
('Gastrocnemius', 'gastrocnemius', 2, 1, (SELECT id FROM muscle_groups WHERE slug = 'calves')),
('Soleus', 'soleus', 2, 2, (SELECT id FROM muscle_groups WHERE slug = 'calves'));