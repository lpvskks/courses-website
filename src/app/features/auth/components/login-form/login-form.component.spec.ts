import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginFormComponent } from './login-form.component';

describe('LoginFormComponent', () => {

  let component: LoginFormComponent;
  let fixture: ComponentFixture<LoginFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginFormComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('если email пустой, то форма должна быть невалидной', () => {

    component.email.set('');
    component.password.set('123456789');

    const result = component.isFormValid();

    expect(result).toBeFalse();
  });

  it('если пароль пустой, то форма должна быть невалидной', () => {

    component.email.set('test@mail.com');
    component.password.set('');

    const result = component.isFormValid();

    expect(result).toBeFalse();
  });

  it('если email имеет неправильный формат, то форма должна быть невалидной', () => {

    component.email.set('invalidEmail');
    component.password.set('123456789');

    const result = component.isFormValid();

    expect(result).toBeFalse();
  });

  it('если пароль меньше 8 символов, то форма должна быть невалидной', () => {

    component.email.set('test@mail.com');
    component.password.set('123');

    const result = component.isFormValid();

    expect(result).toBeFalse();
  });

  it('если email и пароль корректные, то форма должна быть валидной', () => {

    component.email.set('test@mail.com');
    component.password.set('123456789');

    const result = component.isFormValid();

    expect(result).toBeTrue();
  });
});