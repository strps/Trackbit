
INSERT INTO "muscle_groups" ("name", "description") VALUES
('Chest', 'Pectorals - primary muscles worked in pressing movements like bench press'),
('Back', 'Latissimus dorsi, rhomboids, traps - pulling and rowing movements'),
('Shoulders', 'Deltoids (anterior, lateral, posterior) - overhead presses and raises'),
('Biceps', 'Biceps brachii - elbow flexion movements like curls'),
('Triceps', 'Triceps brachii - elbow extension movements like dips and presses'),
('Forearms', 'Flexors and extensors of the wrist and grip muscles'),
('Quadriceps', 'Front thigh muscles - knee extension (squats, leg press)'),
('Hamstrings', 'Back thigh muscles - knee flexion and hip extension'),
('Glutes', 'Gluteus maximus, medius, minimus - hip extension and abduction'),
('Calves', 'Gastrocnemius and soleus - ankle plantarflexion'),
('Core', 'Abdominals (rectus abdominis, obliques) and deeper stabilizers'),
('Lower Back', 'Erector spinae - spinal extension and stability')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint