import { describe, expect, it } from 'vitest';
import { SKILL_POOL, extractSkills } from './skills';

describe('extractSkills', () => {
  it('ignores tools the posting says it is moving away from', () => {
    // The Legends Global posting. The old matcher returned Tableau and Power BI
    // — the two tools the role exists to replace — and none of what it names.
    const line =
      "instead of assembling reports in Tableau or Power BI, you'll use Anthropic's Claude ecosystem " +
      'to build interactive apps in React and TypeScript.';
    const found = extractSkills(line);
    expect(found).not.toContain('Tableau');
    expect(found).not.toContain('Power BI');
    expect(found).toContain('React');
    expect(found).toContain('TypeScript');
  });

  it('keeps the un-negated half of the sentence', () => {
    // The negation ends at the comma; everything after it is a real requirement.
    expect(extractSkills('Rather than Excel, you will work in Snowflake and dbt.')).toEqual(
      expect.arrayContaining(['Snowflake', 'dbt']),
    );
    expect(extractSkills('Rather than Excel, you will work in Snowflake and dbt.')).not.toContain(
      'Excel',
    );
  });

  it('treats a legacy-tool mention as negated', () => {
    expect(
      extractSkills('Prior experience migrating a team off legacy BI tools (Tableau, Looker).'),
    ).toEqual([]);
  });

  it('ranks distinctive tools above commodity ones when truncating', () => {
    const text = 'Requires Excel, SQL, dbt, Snowflake, Databricks and strong Agile practice.';
    // Excel and Agile say little; the warehouse stack is what identifies the role.
    expect(extractSkills(text, 3)).toEqual(['Databricks', 'Snowflake', 'dbt']);
  });

  it('does not read R out of R&D', () => {
    expect(extractSkills('Partner with the R&D organisation.')).not.toContain('R');
    expect(extractSkills('Statistical tools such as R, SAS and MATLAB.')).toContain('R');
  });

  it('no longer carries the skills that matched every posting', () => {
    expect(SKILL_POOL).not.toContain('Communication');
    expect(SKILL_POOL).not.toContain('Storytelling');
    expect(extractSkills('Excellent written and verbal communication skills required.')).toEqual(
      [],
    );
  });

  it('knows the stack that had been typed in by hand', () => {
    const text = 'Automated reporting across Databricks, Microsoft Fabric and Power Automate.';
    expect(extractSkills(text)).toEqual(
      expect.arrayContaining(['Databricks', 'Microsoft Fabric', 'Power Automate']),
    );
  });

  it('does not confuse Power BI with Power Automate', () => {
    expect(extractSkills('Build dashboards in Power BI.')).toEqual(['Power BI']);
    expect(extractSkills('Orchestrate with Power Automate.')).toEqual(['Power Automate']);
  });

  it('returns at most seven, highest signal first', () => {
    const text =
      'SQL, Python, Excel, Tableau, Power BI, Statistics, Agile, dbt, Snowflake, Databricks, React.';
    const found = extractSkills(text);
    expect(found).toHaveLength(7);
    // Order within a tier follows the list in skills.ts; what matters is that
    // the warehouse stack outranks Excel and Agile, not dbt against React.
    expect(found.slice(0, 3)).toEqual(['Databricks', 'Snowflake', 'dbt']);
    expect(found).not.toContain('Excel');
  });

  it('returns nothing for a posting that names no tools', () => {
    expect(extractSkills('We are a learning company that values curiosity.')).toEqual([]);
  });
});

describe('the employer is not a skill', () => {
  it('drops a pool entry that is the company name', () => {
    // The Salesforce posting listed Salesforce as a required skill.
    expect(extractSkills('Join Salesforce and build on our platform.', 7, 'Salesforce')).toEqual(
      [],
    );
  });

  it('still records the tool when someone else asks for it', () => {
    expect(extractSkills('Experience with Salesforce CRM required.', 7, 'Natus')).toContain(
      'Salesforce',
    );
  });
});
