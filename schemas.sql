-- ─────────────────────────────────────────────────────────
-- TEAM DASHBOARD — Database Schema
-- Run: psql -U postgres -d team_dashboard -f schemas.sql
-- ─────────────────────────────────────────────────────────

-- EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
    emp_id              INTEGER PRIMARY KEY,
    emp_name            VARCHAR(100) NOT NULL,
    designation         VARCHAR(100) NOT NULL,
    years_of_exp        INTEGER NOT NULL DEFAULT 0,
    graduation_deg      VARCHAR(100) NOT NULL,
    projects_completed  INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- FUNCTIONAL AREAS
CREATE TABLE IF NOT EXISTS functional_areas (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) UNIQUE NOT NULL
);

-- SEED 5 FUNCTIONAL AREAS
INSERT INTO functional_areas (name) VALUES
    ('Development'),
    ('Data Analytics'),
    ('Design'),
    ('Consultancy'),
    ('Documentation')
ON CONFLICT (name) DO NOTHING;

-- EMPLOYEE AREA RATINGS
CREATE TABLE IF NOT EXISTS employee_area_ratings (
    emp_id              INTEGER REFERENCES employees(emp_id) ON DELETE CASCADE,
    functional_area_id  INTEGER REFERENCES functional_areas(id) ON DELETE CASCADE,
    rating              NUMERIC(4,1) NOT NULL CHECK (rating >= 0 AND rating <= 10),
    PRIMARY KEY (emp_id, functional_area_id)
);

-- ADMINS
CREATE TABLE IF NOT EXISTS admins (
    emp_id      INTEGER PRIMARY KEY REFERENCES employees(emp_id) ON DELETE CASCADE,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- TEAM STATS (single row)
CREATE TABLE IF NOT EXISTS team_stats (
    id                  INTEGER PRIMARY KEY DEFAULT 1,
    projects_completed  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Seed team_stats row
INSERT INTO team_stats (id, projects_completed)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
