import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddPrediction } from './add-prediction';

describe('AddPrediction', () => {
  let component: AddPrediction;
  let fixture: ComponentFixture<AddPrediction>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPrediction]
    }).compileComponents();

    fixture = TestBed.createComponent(AddPrediction);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
