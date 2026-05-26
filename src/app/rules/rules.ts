import { Component } from '@angular/core';

@Component({
  selector: 'app-rules',
  standalone: false,
  templateUrl: './rules.html',
  styleUrl: './rules.css',
})
export class RulesComponent {
  themeColors400: any = {
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    red: 'text-red-400',
    pink: 'text-pink-400',
    purple: 'text-purple-400'
  };

  themeColors600: any = {
    yellow: 'to-yellow-600',
    green: 'to-green-600',
    blue: 'to-blue-600',
    red: 'to-red-600',
    pink: 'to-pink-600',
    purple: 'to-purple-600'
  };

  translations = {
    bg: {
      title: 'Правила на играта',
      subtitle: 'Прогнозирай резултатите, трупай точки и се бори за първото място 🏆',

      deadlineTitle: 'Срок за прогнози',
      deadlineText: 'Прогнози за всички мачове се подават най-късно',
      deadlineHighlight: '5 минути преди първия съдийски сигнал',

      warning: 'При неспазване на крайния срок играчът губи право да даде прогноза за съответния мач.',

      monitoring: 'Димитър следи за спазването на правилата в последните 5 минути преди началото на всяка среща.',

      submitTitle: 'Прогнозите могат да се подават:',
      submitTable: 'Директно в таблицата в таб "Всички прогнози"',
      submitEmail: 'По имейл:',

      editText: 'Промени по прогнозите също се приемат до',
      editHighlight: '5 минути преди началото на мача',

      pointsTitle: 'Точкуване',
      points: 'точки',
      point: 'точка',

      exactScore: 'за познат точен резултат',
      correctOutcome: 'за познат знак',

      coefficientsTitle: 'Коефициенти по фази',

      stage: 'Фаза',
      multiplier: 'Коефициент',

      groupStage: 'Групова фаза',
      roundOf32: 'Шестнайсетинафинали',
      roundOf16: 'Осминафинали',
      quarterFinals: 'Четвъртфинали',
      semiFinals: 'Полуфинали + мач за 3-то място',
      final: 'Финал',

      funTitle: 'И най-важното правило:',
      funText: 'Да се забавляваме!'
    },

    en: {
      title: 'Game Rules',
      subtitle: 'Predict match results, earn points and fight for the top spot 🏆',

      deadlineTitle: 'Prediction Deadline',
      deadlineText: 'Predictions for all matches must be submitted no later than',
      deadlineHighlight: '5 minutes before kick-off',

      warning: 'If the deadline is missed, the player loses the right to submit a prediction for that match.',

      monitoring: 'Dimitar will monitor and enforce the rules during the final 5 minutes before each match starts.',

      submitTitle: 'Predictions can be submitted:',
      submitTable: 'Directly in the table in tab "All Predictions"',
      submitEmail: 'By email:',

      editText: 'Prediction changes are also allowed up to',
      editHighlight: '5 minutes before the match starts',

      pointsTitle: 'Scoring System',
      points: 'points',
      point: 'point',

      exactScore: 'for an exact score prediction',
      correctOutcome: 'for predicting the correct outcome',

      coefficientsTitle: 'Stage Multipliers',

      stage: 'Stage',
      multiplier: 'Multiplier',

      groupStage: 'Group Stage',
      roundOf32: 'Round of 32',
      roundOf16: 'Round of 16',
      quarterFinals: 'Quarter-finals',
      semiFinals: 'Semi-finals + 3rd place match',
      final: 'Final',

      funTitle: 'And most importantly:',
      funText: 'Have fun!'
    }
  };

  get t() {
    let isLngBg = localStorage.getItem('lang') === 'bg';
    return isLngBg
      ? this.translations.bg
      : this.translations.en;
  }


  get themeColor400() {
    const color = localStorage.getItem('theme-color') || 'yellow';
    return this.themeColors400[color] || 'text-yellow-400';
  }

  get themeColor600() {
    const color = localStorage.getItem('theme-color') || 'yellow';
    return this.themeColors600[color] || 'text-yellow-600';
  }

  get colorFromTs() {
    return '#25f11e'
  }

  animate = true;

  iconColor = '#22c55e'; // or dynamic

  ngOnInit() {
    this.animate = false;

    setTimeout(() => {
      this.animate = true;
    }, 100);
  }
}
