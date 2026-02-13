import { BasePlatform } from '../core/BasePlatform.js';

export class InitechAdapter extends BasePlatform {
  protected async apply(): Promise<string> {
    this.logger.info('Filling Initech Corp application (tabbed form)...');

    await this.fillProfileTab();
    await this.clickTab('Qualifications');

    await this.fillQualificationsTab();
    await this.clickTab('Preferences');

    await this.fillPreferencesTab();

    await this.screenshot('before-submit');

    this.logger.info('Submitting Initech application...');
    await this.click('#i-submit-btn');

    await this.waitFor('#initech-success', { state: 'visible', timeout: 15000 });

    await this.screenshot('success');

    const refNumber = await this.page.textContent('#initech-ref');

    if (!refNumber) {
      throw new Error('Reference number not found on success page');
    }

    this.logger.info(`Application submitted: ${refNumber.trim()}`);
    return refNumber.trim();
  }

  private async clickTab(tabName: string): Promise<void> {
    await this.click(`.tab-btn:has-text("${tabName}")`);
    await this.humanBehavior.randomDelay(300, 600);
  }

  private async fillProfileTab(): Promise<void> {
    this.logger.info('Tab: Profile');

    await this.type('#i-fname', this.profile.firstName);
    await this.type('#i-lname', this.profile.lastName);
    await this.type('#i-email', this.profile.email, { fieldType: 'email' });
    await this.type('#i-phone', this.profile.phone, { fieldType: 'phone' });
    await this.type('#i-location', this.profile.location);

    if (this.profile.linkedIn) {
      await this.type('#i-linkedin', this.profile.linkedIn);
    }

    if (this.profile.portfolio) {
      await this.type('#i-portfolio', this.profile.portfolio);
    }

    if (this.profile.resumePath) {
      await this.uploadFile('#i-resume', this.profile.resumePath);
    }
  }

  private async fillQualificationsTab(): Promise<void> {
    this.logger.info('Tab: Qualifications');

    await this.select('#i-experience', this.profile.experienceLevel, { required: true });
    await this.select('#i-education', this.profile.education, { required: true });

    await this.selectSmart(
      '#i-school',
      '#i-school-results',
      this.profile.school,
      { waitForSpinner: '#i-school-spinner' }
    );

    for (const skill of this.profile.skills) {
      await this.check('#i-skills-group', skill);
    }
  }

  private async fillPreferencesTab(): Promise<void> {
    this.logger.info('Tab: Preferences');

    const workAuthValue = this.profile.workAuthorized ? 'yes' : 'no';
    await this.check('.radio-group:has(input[name="workAuth"])', workAuthValue, { required: true });

    if (this.profile.workAuthorized && this.profile.requiresVisa) {
      await this.waitFor('#i-visa-group', { state: 'visible' });
      await this.check('#i-visa-group .radio-group', 'yes', { required: true });
    }

    await this.type('#i-start-date', this.profile.earliestStartDate, { fieldType: 'date' });

    if (this.profile.salaryExpectation) {
      await this.select('#i-salary', this.profile.salaryExpectation, { required: true });
    }

    await this.select('#i-referral', this.profile.referralSource, { required: true });

    await this.type('#i-cover-letter', this.profile.coverLetter);

    await this.click('#i-consent');
  }
}
