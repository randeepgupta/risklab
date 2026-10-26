import copy
import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
sys.dont_write_bytecode=True
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('report',ROOT/'scripts/risk-model-report.py')
report=importlib.util.module_from_spec(spec);spec.loader.exec_module(report)


def snapshot():
    return {'asOf':'2026-10-23','capturedAt':'2026-10-25T00:00:00Z','sourceRevision':'new',
        'coverage':{'requested':3,'covered':2,'excluded':1},'dates':['2026-10-21','2026-10-22','2026-10-23'],
        'symbols':{'SPY':{'values':[100,101,102]},'A':{'values':[100,None,102]}},
        'exclusions':{'Q':'unverified_extreme_return'},'dataQuality':{'quarantined':{'Q':{}},'actionFeeds':{},'reviewedSplitOverrides':[]},
        'treasuryYields':{'series':'DGS10','startDate':'2026-10-21','endDate':'2026-10-22','observations':2,'source':'official'}}


class ReportTests(unittest.TestCase):
    def test_baseline_is_not_invented(self):
        value=report.build_report(snapshot(),code_revision='test-code')
        self.assertIsNone(value['comparison'])
        self.assertEqual(value['quality']['quarantinedCount'],1)
        self.assertEqual(value['quality']['missingPriceObservations'],{'A':1})
        self.assertIn('not independent',report.markdown(value))
        self.assertIn('No comparison baseline',report.markdown(value))

    def test_return_rebasing_is_not_a_data_revision(self):
        before=snapshot();after=copy.deepcopy(before)
        after['symbols']['SPY']['values']=[200,202,204]
        self.assertEqual(report.build_report(after,before)['comparison']['revisedReturns'],{})

    def test_revision_coverage_and_quarantine_changes(self):
        before=snapshot();after=snapshot()
        after['symbols']['SPY']['values']=[100,103,102]
        del after['symbols']['A'];after['symbols']['B']={'values':[100,101,102]}
        after['dataQuality']['quarantined']={'A':{}}
        value=report.build_report(after,before)['comparison']
        self.assertEqual(value['coverageAdded'],['B']);self.assertEqual(value['coverageRemoved'],['A'])
        self.assertEqual(value['quarantineAdded'],['A']);self.assertEqual(value['quarantineRemoved'],['Q'])
        self.assertEqual(value['revisedReturns']['SPY']['changedIntervals'],2)
        self.assertNotIn('A',value['revisedReturns'])

    def test_missing_intervals_cannot_be_compared_as_daily_returns(self):
        before=snapshot();after=snapshot()
        after['symbols']['A']['values']=[100,101,102]
        self.assertNotIn('A',report.build_report(after,before)['comparison']['revisedReturns'])

    def test_incomplete_or_invalid_input_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/'snapshot.json'
            value=snapshot();value['coverage']['covered']=3;path.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError,'Incomplete'):report.load_snapshot(path)
            value=snapshot();value['symbols']['SPY']['values'][1]=0;path.write_text(json.dumps(value))
            with self.assertRaisesRegex(ValueError,'Invalid snapshot price'):report.load_snapshot(path)


if __name__=='__main__':unittest.main()
