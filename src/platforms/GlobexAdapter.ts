import { BasePlatform } from '../core/BasePlatform.js';
import { findBestMatch } from '../utils/matcher.js';

export class GlobexAdapter extends BasePlatform {
  protected async apply(): Promise<string> {
    this.logger.info('Filling Globex Corp application (accordion form)...');

    await this.fillPersonalInfoSection();
    await this.fillEducationSection();
    await this.fillExperienceSection();
    await this.fillAdditionalInfoSection();
    
    await this.screenshot('before-submit');
    
    this.logger.info('Submitting Globex application...');
    await this.click('#globex-submit');

    await this.waitFor('.globex-confirmation', { state: 'visible', timeout: 15000 });
    
    await this.screenshot('success');

    const referenceNumber = await this.page.textContent('#globex-ref');
    
    if (!referenceNumber) {
      throw new Error('Reference number not found on success page');
    }

    this.logger.info(`Application submitted successfully: ${referenceNumber.trim()}`);
    return referenceNumber.trim();
  }

  private async expandSection(sectionName: string): Promise<void> {
    const headerSelector = `.section-header:has-text("${sectionName}")`;
    const isOpen = await this.page.locator(headerSelector).evaluate(el => 
      el.classList.contains('open')
    );
    
    if (!isOpen) {
      await this.click(headerSelector);
      await this.humanBehavior.randomDelay(300, 500);
    }
  }

  private async fillPersonalInfoSection(): Promise<void> {
    this.logger.info('Section: Personal Information');
    
    await this.expandSection('Contact Details');

    await this.type('#g-fname', this.profile.firstName);
    await this.type('#g-lname', this.profile.lastName);
    await this.type('#g-email', this.profile.email, { fieldType: 'email' });
    await this.type('#g-phone', this.profile.phone, { fieldType: 'phone' });
    await this.type('#g-city', this.profile.location);

    if (this.profile.linkedIn) {
      await this.type('#g-linkedin', this.profile.linkedIn);
    }

    if (this.profile.portfolio) {
      await this.type('#g-website', this.profile.portfolio);
    }
  }

  private async fillEducationSection(): Promise<void> {
    this.logger.info('Section: Education');
    
    await this.expandSection('Qualifications');

    if (this.profile.resumePath) {
      await this.uploadFile('#g-resume', this.profile.resumePath);
    }

    await this.select('#g-experience', this.profile.experienceLevel, { required: true });
    await this.select('#g-degree', this.profile.education, { required: true });

    await this.selectSmart(
      '#g-school',
      '#g-school-results',
      this.profile.school,
      { waitForSpinner: '#g-school-spinner' }
    );

    for (const skill of this.profile.skills) {
      await this.clickSkillChip(skill);
    }
  }

  private async fillExperienceSection(): Promise<void> {
    this.logger.info('Section: Additional Information (work auth, salary, etc)');
    
    await this.expandSection('Additional Information');

    await this.toggleSwitch('#g-work-auth-toggle', this.profile.workAuthorized);

    if (this.profile.workAuthorized && this.profile.requiresVisa) {
      await this.waitFor('#g-visa-block', { state: 'visible' });
      await this.toggleSwitch('#g-visa-toggle', true);
    }

    await this.type('#g-start-date', this.profile.earliestStartDate, { fieldType: 'date' });

    if (this.profile.salaryExpectation) {
      await this.setSalarySlider(this.profile.salaryExpectation);
    }

    await this.select('#g-source', this.profile.referralSource, { required: true });
  }

  private async fillAdditionalInfoSection(): Promise<void> {
    this.logger.info('Section: Additional Information (cover letter)');

    await this.type('#g-motivation', this.profile.coverLetter);

    await this.click('#g-consent');
  }

  private async clickSkillChip(skill: string): Promise<void> {
    await this.retryWithBackoff(async () => {
      const chips = await this.page.$$eval('.chip', (elements) =>
        elements.map(el => {
          const chipEl = el as HTMLElement;
          return {
            skill: chipEl.dataset.skill || '',
            text: chipEl.textContent?.trim() || ''
          };
        })
      );

      const matchableOptions = chips.map(chip => ({
        value: chip.skill,
        text: chip.text,
        disabled: false
      }));

      const matchedValue = findBestMatch(skill, matchableOptions);

      if (!matchedValue) {
        throw new Error(`Skill chip not found: ${skill}`);
      }

      const chipSelector = `.chip[data-skill="${matchedValue}"]`;
      const isSelected = await this.page.locator(chipSelector).evaluate(el => 
        el.classList.contains('selected')
      );

      if (!isSelected) {
        await this.click(chipSelector);
        this.logger.debug(`Selected skill chip: ${skill} -> ${matchedValue}`);
      } else {
        this.logger.debug(`Skill chip already selected: ${skill}`);
      }
    }, `clickSkillChip ${skill}`);
  }

  private async toggleSwitch(selector: string, targetState: boolean): Promise<void> {
    await this.retryWithBackoff(async () => {
      const element = this.page.locator(selector);
      
      const currentState = await element.evaluate((el: Element) => {
        const toggleEl = el as HTMLElement;
        return toggleEl.dataset.value === 'true';
      });

      if (currentState !== targetState) {
        await this.click(selector);
        await this.humanBehavior.randomDelay();
        this.logger.debug(`Toggled switch ${selector}: ${currentState} -> ${targetState}`);
      } else {
        this.logger.debug(`Switch ${selector} already in desired state: ${targetState}`);
      }
    }, `toggleSwitch ${selector}`);
  }

  private async setSalarySlider(salaryExpectation: string): Promise<void> {
    const salary = parseInt(salaryExpectation.replace(/\D/g, ''), 10);
    
    if (isNaN(salary)) {
      this.logger.warn(`Invalid salary format: ${salaryExpectation}`);
      return;
    }

    await this.retryWithBackoff(async () => {
      const slider = this.page.locator('#g-salary');
      
      const min = parseInt(await slider.getAttribute('min') || '30000', 10);
      const max = parseInt(await slider.getAttribute('max') || '200000', 10);
      
      const clampedSalary = Math.max(min, Math.min(max, salary));
      
      await slider.fill(clampedSalary.toString());
      await this.humanBehavior.randomDelay();

      this.logger.debug(`Set salary slider: ${clampedSalary}`);
    }, 'setSalarySlider');
  }
}
