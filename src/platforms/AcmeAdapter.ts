import { BasePlatform } from '../core/BasePlatform.js';

export class AcmeAdapter extends BasePlatform {
  protected async apply(): Promise<string> {
    this.logger.info('Filling Acme Corp application (4-step wizard)...');

    await this.fillStep1PersonalInfo();
    await this.clickContinue();

    await this.fillStep2ExperienceAndEducation();
    await this.clickContinue();

    await this.fillStep3Questions();
    await this.clickContinue();

    await this.fillStep4Review();

    await this.screenshot('before-submit');

    this.logger.info('Submitting Acme application...');
    await this.click('button[type="submit"]:has-text("Submit Application")');

    await this.waitFor('#success-page', { state: 'visible', timeout: 15000 });

    await this.screenshot('success');

    const confirmationId = await this.page.textContent('#confirmation-id');

    if (!confirmationId) {
      throw new Error('Confirmation ID not found on success page');
    }

    this.logger.info(`Application submitted successfully: ${confirmationId.trim()}`);
    return confirmationId.trim();
  }

  private async fillStep1PersonalInfo(): Promise<void> {
    this.logger.info('Step 1: Personal Information');

    await this.type('#first-name', this.profile.firstName);
    await this.type('#last-name', this.profile.lastName);
    await this.type('#email', this.profile.email, { fieldType: 'email' });
    await this.type('#phone', this.profile.phone, { fieldType: 'phone' });
    await this.type('#location', this.profile.location);

    if (this.profile.linkedIn) {
      await this.type('#linkedin', this.profile.linkedIn);
    }

    if (this.profile.portfolio) {
      await this.type('#portfolio', this.profile.portfolio);
    }
  }

  private async fillStep2ExperienceAndEducation(): Promise<void> {
    this.logger.info('Step 2: Experience & Education');

    if (this.profile.resumePath) {
      await this.uploadFile('#resume', this.profile.resumePath);
    }

    await this.select('#experience-level', this.profile.experienceLevel, { required: true });
    await this.select('#education', this.profile.education, { required: true });

    await this.selectSmart(
      '#school',
      '#school-dropdown',
      this.profile.school
    );

    for (const skill of this.profile.skills) {
      await this.check('#skills-group', skill);
    }

  }

  private async fillStep3Questions(): Promise<void> {
    this.logger.info('Step 3: Additional Questions');

    const workAuthValue = this.profile.workAuthorized ? 'yes' : 'no';
    await this.check('div.radio-group:has(input[name="workAuth"])', workAuthValue, { required: true });

    if (this.profile.workAuthorized && this.profile.requiresVisa) {
      await this.waitFor('#visa-sponsorship-group', { state: 'visible' });
      await this.check('#visa-sponsorship-group .radio-group', 'yes', { required: true });
    }

    await this.type('#start-date', this.profile.earliestStartDate, { fieldType: 'date' });

    if (this.profile.salaryExpectation) {
      await this.type('#salary-expectation', this.profile.salaryExpectation);
    }

    await this.select('#referral', this.profile.referralSource, { required: true });

    await this.type('#cover-letter', this.profile.coverLetter);
  }

  private async fillStep4Review(): Promise<void> {
    this.logger.info('Step 4: Review & Submit');

    await this.waitFor('.review-section', { state: 'visible' });

    await this.click('#terms-agree');
  }

  private async clickContinue(): Promise<void> {
    await this.click('.active button.btn.btn-primary:has-text("Continue")');
    await this.humanBehavior.randomDelay(500, 1000);
  }
}
