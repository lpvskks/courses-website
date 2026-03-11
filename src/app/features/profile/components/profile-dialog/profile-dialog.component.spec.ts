import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

describe('ProfileDialogComponent', () => {
  let component: ProfileDialogComponent;
  let fixture: ComponentFixture<ProfileDialogComponent>;

  let profileServiceMock: {
    getMe: () => any;
    updateMe: (payload: UpdateUserProfileRequest) => any;
    lastUpdatePayload: UpdateUserProfileRequest | null;
  };

  let dialogRefMock: {
    close: () => void;
    closeCalled: boolean;
  };

  const profileResponse: UserProfileResponse = {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    firstName: 'Иван',
    lastName: 'Иванов',
    middleName: 'Иванович',
    email: 'ivanov@test.com',
  };

  beforeEach(async () => {
    profileServiceMock = {
      lastUpdatePayload: null,

      getMe: () => of(profileResponse),

      updateMe: (payload: UpdateUserProfileRequest) => {
        profileServiceMock.lastUpdatePayload = payload;

        return of({
          id: profileResponse.id,
          firstName: payload.firstName,
          lastName: payload.lastName,
          middleName: payload.middleName,
          email: payload.email,
        });
      },
    };

    dialogRefMock = {
      closeCalled: false,
      close: () => {
        dialogRefMock.closeCalled = true;
      },
    };

    await TestBed.configureTestingModule({
      imports: [ProfileDialogComponent],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('при инициализации должен загрузить профиль и заполнить форму данными пользователя', () => {
    expect(component.profileId()).toBe(profileResponse.id);
    expect(component.form.controls.firstName.getRawValue()).toBe('Иван');
    expect(component.form.controls.lastName.getRawValue()).toBe('Иванов');
    expect(component.form.controls.middleName.getRawValue()).toBe('Иванович');
    expect(component.form.controls.email.getRawValue()).toBe('ivanov@test.com');

    expect(component.isLoading()).toBe(false);
    expect(component.form.disabled).toBe(true);
  });

  it('если загрузка профиля завершилась ошибкой, должно показываться сообщение об ошибке', () => {
    profileServiceMock.getMe = () => throwError(() => new Error('load error'));

    fixture = TestBed.createComponent(ProfileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.loadError()).toBe('Не удалось загрузить профиль');
  });

  it('при enableEdit форма должна становиться доступной для редактирования', () => {
    component.enableEdit();

    expect(component.isEditMode()).toBe(true);
    expect(component.form.enabled).toBe(true);
  });

  it('при cancelEdit форма должна снова блокироваться и возвращаться к исходным данным', () => {
    component.enableEdit();

    component.form.controls.firstName.setValue('Петр');
    component.form.controls.lastName.setValue('Петров');

    component.cancelEdit();

    expect(component.isEditMode()).toBe(false);
    expect(component.form.disabled).toBe(true);

    expect(component.form.controls.firstName.getRawValue()).toBe('Иван');
    expect(component.form.controls.lastName.getRawValue()).toBe('Иванов');
  });

  it('если форма невалидна, save не должен отправлять запрос на обновление', () => {
    component.enableEdit();

    component.form.controls.firstName.setValue('');
    component.form.controls.lastName.setValue('');
    component.form.controls.email.setValue('wrong-email');

    component.save();

    expect(profileServiceMock.lastUpdatePayload).toBe(null);
  });

  it('если форма валидна, save должен отправлять корректную модель на обновление', () => {
    component.enableEdit();

    component.form.controls.firstName.setValue('  Анна  ');
    component.form.controls.lastName.setValue('  Петрова  ');
    component.form.controls.middleName.setValue('  Сергеевна  ');
    component.form.controls.email.setValue('  anna@test.com  ');

    component.save();

    expect(profileServiceMock.lastUpdatePayload).toEqual({
      firstName: 'Анна',
      lastName: 'Петрова',
      middleName: 'Сергеевна',
      email: 'anna@test.com',
    });
  });

  it('после успешного сохранения форма должна обновиться, заблокироваться и режим редактирования должен выключиться', () => {
    component.enableEdit();

    component.form.controls.firstName.setValue('Мария');
    component.form.controls.lastName.setValue('Сидорова');
    component.form.controls.middleName.setValue('Андреевна');
    component.form.controls.email.setValue('maria@test.com');

    component.save();

    expect(component.isEditMode()).toBe(false);
    expect(component.form.disabled).toBe(true);
    expect(component.successMessage()).toBe('Профиль успешно обновлён');

    expect(component.form.controls.firstName.getRawValue()).toBe('Мария');
    expect(component.form.controls.lastName.getRawValue()).toBe('Сидорова');
    expect(component.form.controls.middleName.getRawValue()).toBe('Андреевна');
    expect(component.form.controls.email.getRawValue()).toBe('maria@test.com');
  });

  it('если сохранение завершилось ошибкой, должно показываться сообщение об ошибке', () => {
    profileServiceMock.updateMe = () =>
      throwError(() => new Error('save error'));

    fixture = TestBed.createComponent(ProfileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.enableEdit();

    component.form.controls.firstName.setValue('Анна');
    component.form.controls.lastName.setValue('Петрова');
    component.form.controls.middleName.setValue('Игоревна');
    component.form.controls.email.setValue('anna@test.com');

    component.save();

    expect(component.submitError()).toBe('Не удалось сохранить изменения');
    expect(component.isEditMode()).toBe(true);
    expect(component.form.enabled).toBe(true);
  });

  it('если имя пустое, должно возвращаться сообщение "Введите имя"', () => {
    component.enableEdit();

    component.form.controls.firstName.setValue('');
    component.form.controls.firstName.markAsTouched();

    expect(component.firstNameError).toBe('Введите имя');
  });

  it('если имя короче 2 символов, должно возвращаться сообщение о минимальной длине', () => {
    component.enableEdit();

    component.form.controls.firstName.setValue('А');
    component.form.controls.firstName.markAsTouched();

    expect(component.firstNameError).toBe('Имя должно быть не менее 2 символов');
  });

  it('если email пустой, должно возвращаться сообщение "Введите email"', () => {
    component.enableEdit();

    component.form.controls.email.setValue('');
    component.form.controls.email.markAsTouched();

    expect(component.emailError).toBe('Введите email');
  });

  it('если email некорректный, должно возвращаться сообщение "Введите корректный email"', () => {
    component.enableEdit();

    component.form.controls.email.setValue('wrong-email');
    component.form.controls.email.markAsTouched();

    expect(component.emailError).toBe('Введите корректный email');
  });

  it('при close должен закрываться диалог', () => {
    component.close();

    expect(dialogRefMock.closeCalled).toBe(true);
  });
});